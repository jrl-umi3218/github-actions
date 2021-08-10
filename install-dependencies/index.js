const cache = require('@actions/cache');
const core = require('@actions/core');
const crypto = require('crypto');
const exec = require('@actions/exec');
const fs = require('fs');
const github = require('@actions/github');
const io = require('@actions/io');
const os = require('os');
const yaml = require('js-yaml');

const utils = require('../utils');

async function handle_ppa(ppas_str)
{
  const ppas = ppas_str.split(' ');
  for(let i = 0; i < ppas.length; i++)
  {
    const ppa = ppas[i];
    await exec.exec('sudo add-apt-repository -y ppa:' + ppa);
  }
}

async function get_os_name()
{
  if(process.platform == 'linux')
  {
    let dist_name = '';
    const options = {};
    options.listeners = {
      stdout: (data) => {
        dist_name += data.toString();
      }
    };
    await exec.exec('lsb_release', ['-sc'], options);
    dist_name = dist_name.trim();
    return `${process.platform}_${dist_name}`;
  }
  else
  {
    return process.platform;
  }
}

function hash(file)
{
  if(!fs.existsSync(file))
  {
    return '0';
  }
  const fb = fs.readFileSync(file);
  const hasher = crypto.createHash('sha1');
  hasher.update(fb);
  return hasher.digest('hex');
}

async function bash(cmd)
{
  return exec.exec('bash', ['-c', cmd]);
}

async function bootstrap_vcpkg(vcpkg, compiler)
{
  if(!vcpkg)
  {
    return;
  }
  if(!vcpkg.repo)
  {
    throw new Error(`vcpkg object must have a repo member!\nGot:\n${vcpkg}\n`);
  }
  if(!vcpkg.token)
  {
    throw new Error(`vcpkg object must have a token member!\nGot:\n${vcpkg}\n`);
  }
  core.startGroup('Restore vcpkg cache');
    const octokit = github.getOctokit(vcpkg.token);
    const cwd = process.cwd();
    const vcpkg_org = vcpkg.repo.split('/')[0];
    const vcpkg_repo = vcpkg.repo.split('/')[1];
    const vcpkg_dir = `${cwd}/${vcpkg_repo}`;
    const sha_data = await octokit.rest.repos.listCommits({owner: vcpkg_org, repo: vcpkg_repo, per_page: 1});
    const vcpkg_hash = sha_data.data[0].sha;
    const context = github.context;
    // See https://github.com/microsoft/vcpkg/issues/16579
    core.exportVariable('X_VCPKG_NUGET_ID_PREFIX', context.repo.repo);
    core.exportVariable('VCPKG_BINARY_SOURCES', 'clear;nuget,GitHub,readwrite');
    core.exportVariable('VCPKG_ROOT', `${vcpkg_dir}`);
    core.exportVariable('VCPKG_TOOLCHAIN', `${vcpkg_dir}/scripts/buildsystems/vcpkg.cmake`);
    core.exportVariable('VCPKG_FEATURE_FLAGS', 'manifests,registries,binarycaching');
    if(process.platform === 'win32')
    {
      core.exportVariable('VCPKG_DEFAULT_TRIPLET', 'x64-windows');
    }
    if(vcpkg.registries)
    {
      let vcpkg_config = {};
      if(fs.existsSync('vcpkg-configuration.json'))
      {
        vcpkg_config = JSON.parse(fs.readFileSync('vcpkg-configuration.json'));
      }
      if(!vcpkg_config.registries)
      {
        vcpkg_config.registries = [];
      }
      for(const reg of vcpkg.registries)
      {
        let vcpkg_registry = { repository: `https://github.com/${reg.repo}`, kind: "git", packages: reg.packages };
        const vcpkg_org = reg.repo.split('/')[0];
        const vcpkg_repo = reg.repo.split('/')[1];
        const sha_data = await octokit.rest.repos.listCommits({owner: vcpkg_org, repo: vcpkg_repo, per_page: 1});
        vcpkg_registry.baseline = sha_data.data[0].sha;
        vcpkg_config.registries.push(vcpkg_registry);
      }
      let vcpkg_config_str = JSON.stringify(vcpkg_config, null, 2);
      console.log(`Use vcpkg-configuration.json:\n${vcpkg_config_str}`);
      fs.writeFileSync('vcpkg-configuration.json', vcpkg_config_str);
    }
    const cache_key_common = `vcpkg_1_${await get_os_name()}-`;
    const cache_key = `${cache_key_common}${vcpkg_hash}-${hash('vcpkg.json')}-${hash('vcpkg-configuration.json')}`;
    const cache_paths = [vcpkg_dir, 'build/vcpkg_installed'];
    const cache_restore_keys = [cache_key_common];
    const cache_hit = await cache.restoreCache(cache_paths, cache_key, cache_restore_keys);
    console.log(`Got cache entry ${cache_hit} when restoring ${cache_key}`);
    if(!cache_hit)
    {
      await exec.exec('git clone --recursive https://github.com/' + vcpkg.repo);
    }
    else
    {
      core.endGroup();
      core.startGroup('Show build/vcpkg_installed content');
        await bash('ls -lR build/vcpkg_installed');
    }
  core.endGroup();
  if(cache_hit == cache_key)
  {
    return;
  }
  core.exportVariable('VCPKG_CACHE_KEY', cache_key);
  let vcpkg_prev_hash = '';
  if(cache_hit)
  {
    vcpkg_prev_hash = cache_hit.split('-')[1];
  }
  process.chdir(vcpkg_dir);
  if(vcpkg_prev_hash != vcpkg_hash)
  {
    await bash('git pull');
    core.startGroup('Bootstrap vcpkg');
    if(process.platform === 'win32')
    {
      await bash('./bootstrap-vcpkg.bat');
    }
    else
    {
      if(process.platform === 'linux')
      {
        if(compiler === 'gcc')
        {
          core.exportVariable('CXX', 'g++');
        }
        else
        {
          core.exportVariable('CXX', 'clang++');
        }
        await bash('./bootstrap-vcpkg.sh');
      }
      else
      {
        await bash('./bootstrap-vcpkg.sh -allowAppleClang');
      }
    }
    core.endGroup();
  }
  process.chdir(cwd);
}

async function setup_binary_caching_vcpkg(vcpkg)
{
  const context = github.context;
  const owner = vcpkg.owner || context.repo.owner;
  const token = vcpkg.token;
  let mono = 'mono';
  if(process.platform == 'win32')
  {
    mono = '';
  }
  await bash(`${mono} \`./vcpkg/vcpkg fetch nuget | tail -n 1\` sources add -source "https://nuget.pkg.github.com/${owner}/index.json" -storepasswordincleartext -name "GitHub" -username "${owner}" -password "${token}"`);
}

async function handle_vcpkg(vcpkg, compiler)
{
  if(!vcpkg)
  {
    return;
  }
  await bootstrap_vcpkg(vcpkg, compiler);
  await setup_binary_caching_vcpkg(vcpkg);
  const debug_opt = vcpkg.debug ? '--debug' : '';
  core.startGroup('Install vcpkg dependencies');
    await io.mkdirP('build');
    await bash(`./vcpkg/vcpkg install ${debug_opt} --x-install-root=build/vcpkg_installed`);
  core.endGroup();
}

async function build_github_repo(path, ref, btype, options, sudo, build_dir)
{
  if(path.startsWith('https://'))
  {
    url = path;
    while(url.length > 1 && url[url.length - 1] == '/')
    {
      url = url.substr(0, url.length - 1);
    }
    path = url.split('/').pop();
  }
  else
  {
    url = 'https://github.com/' + path;
  }
  core.startGroup('Building ' + path);
  core.startGroup('--> Cloning ' + path);
  await exec.exec('git clone --recursive ' + url + ' ' + path)
  const cwd = process.cwd();
  const project_path = cwd + '/' + path;
  process.chdir(project_path);
  await exec.exec('git checkout ' + ref)
  await exec.exec('git submodule sync')
  await exec.exec('git submodule update')
  process.chdir(cwd);
  // For projects that use cmake_add_fortran_subdirectory we need to hide sh from the PATH
  const OLD_PATH = process.env.PATH;
  PATH = OLD_PATH;
  while(PATH.indexOf('Git') != -1)
  {
    PATH = PATH.replace('Git', 'dummy');
  }
  // Undo this otherwise gfortran libs are hidden
  PATH.replace('C:\Program Files\dummy\mingw64\bin', 'C:\Program Files\Git\mingw64\bin');
  core.exportVariable('PATH', PATH);
  core.startGroup("Modified PATH variable");
  console.log(PATH);
  core.endGroup();
  await io.mkdirP(build_dir);
  process.chdir(build_dir);
  core.endGroup();
  core.startGroup('--> Configure ' + path);
  await exec.exec('cmake ' + project_path + ' -DCMAKE_BUILD_TYPE=' + btype + ' ' + options);
  core.endGroup();
  core.startGroup('--> Building ' + path);
  let build_cmd = 'cmake --build . --config ' + btype;
  if(process.platform === 'win32')
  {
    build_cmd = build_cmd + ` -- /p:CL_MPcount=${os.cpus().length}`;
  }
  await exec.exec(build_cmd);
  core.endGroup();
  core.startGroup('--> Install ' + path);
  if(sudo)
  {
    await exec.exec('sudo cmake --build . --target install --config ' + btype);
  }
  else
  {
    await exec.exec('cmake --build . --target install --config ' + btype);
  }
  core.endGroup();
  process.chdir(cwd);
  // Restore PATH setting
  core.exportVariable('PATH', OLD_PATH);
  core.endGroup();
}

async function handle_github(github, btype, options, sudo, linux = false)
{
  if(!github)
  {
    return;
  }
  core.startGroup("Install GitHub dependencies");
  GIT_DEPENDENCIES = process.env.GIT_DEPENDENCIES ? process.env.GIT_DEPENDENCIES : '';
  for(let i = 0; i < github.length; ++i)
  {
    const entry = github[i];
    ref = entry.ref ? entry.ref : "master";
    GIT_DEPENDENCIES += ' ' + entry.path + '#' + ref;
    let entry_options = options;
    if(entry.options)
    {
      entry_options = entry_options + " " + entry.options;
    }
    if(process.platform === 'win32' && entry['windows-options'])
    {
      entry_options = entry_options + ' ' + entry['windows-options'];
    }
    if(process.platform === 'darwin' && entry['macos-options'])
    {
      entry_options = entry_options + ' ' + entry['macos-options'];
    }
    if(process.platform === 'linux' && entry['linux-options'])
    {
      entry_options = entry_options + ' ' + entry['linux-options'];
    }
    build_dir = linux ? '/tmp/_ci/build/' + entry.path : entry.path + '/build';
    await build_github_repo(entry.path, ref, btype, entry_options, sudo, build_dir);
  }
  core.exportVariable('GIT_DEPENDENCIES', GIT_DEPENDENCIES.trim());
  core.endGroup();
}

async function run()
{
  try
  {
    core.exportVariable('CMAKE_BUILD_PARALLEL_LEVEL', os.cpus().length);
    const btype = core.getInput('build-type');
    const vcpkg_global = yaml.safeLoad(core.getInput('vcpkg'));
    if(process.platform === 'win32')
    {
      const input = yaml.safeLoad(core.getInput('windows'));
      if(!( (input && input.vcpkg) || vcpkg_global ))
      {
        await utils.setup_boost();
      }
      PATH = process.env.PATH;
      if(PATH.indexOf('C:\\devel\\install\\bin') == -1)
      {
        core.exportVariable('PATH', 'C:\\devel\\install\\bin;' + PATH);
      }
      PKG_CONFIG_PATH = process.env.PKG_CONFIG_PATH ? process.env.PKG_CONFIG_PATH : "";
      if(PKG_CONFIG_PATH.indexOf('C:\\devel\\install\\lib\\pkgconfig') == -1)
      {
        core.exportVariable('PKG_CONFIG_PATH', 'C:\\devel\\install\\lib\\pkgconfig;' + PKG_CONFIG_PATH);
      }
      let options = '-DCMAKE_CXX_FLAGS_INIT=\'/MP\' -DCMAKE_INSTALL_PREFIX=C:/devel/install -DBUILD_TESTING:BOOL=OFF -DBoost_USE_STATIC_LIBS=OFF';
      options += ' ' + core.getInput('options') + ' ' + core.getInput('windows-options');
      if(input)
      {
        if(input.options)
        {
          options += ' ' + input.options;
        }
        if(input.choco)
        {
          core.startGroup("Install chocolatey dependencies");
          await exec.exec('choco install ' + input.choco + ' -y');
          core.endGroup();
        }
        if(input.pip)
        {
          core.startGroup("Install pip dependencies");
          await exec.exec('pip install ' + input.pip);
          core.endGroup();
        }
        if(btype.toLowerCase() == 'debug')
        {
          options = options + ' -DPYTHON_BINDING:BOOL=OFF';
        }
        if(input.github)
        {
          core.startGroup("Install Windows specific GitHub dependencies");
          await handle_github(input.github, btype, options, false);
          core.endGroup();
        }
      }
      const vcpkg = (input && input.vcpkg) || vcpkg_global;
      await handle_vcpkg(vcpkg, '');
      const github = yaml.safeLoad(core.getInput('github'));
      await handle_github(github, btype, options, false);
    }
    else if(process.platform === 'darwin')
    {
      const input = yaml.safeLoad(core.getInput('macos'));
      let options = '-DPYTHON_BINDING_FORCE_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
      options += ' ' + core.getInput('options') + ' ' + core.getInput('macos-options');
      if(input)
      {
        if(input.options)
        {
          options += ' ' + input.options;
        }
        if(input.cask || input.brew)
        {
          core.startGroup("Run Homebrew update");
          await exec.exec('brew update');
          core.endGroup();
        }
        if(input['brew-taps'])
        {
          const taps = input['brew-taps'].split(' ');
          for(let i = 0; i < taps.length; i++)
          {
            const tap = taps[i];
            await exec.exec(`brew tap ${tap}`);
          }
        }
        if(input.cask)
        {
          core.startGroup("Install Homebrew cask dependencies");
          await bash('brew install --cask ' + input.cask + ' || true');
          await bash('brew upgrade --cask ' + input.cask + ' || true');
          core.endGroup();
        }
        if(input.brew)
        {
          core.startGroup("Install Homebrew dependencies");
          await bash('brew install ' + input.brew + ' || true');
          await bash('brew upgrade ' + input.brew + ' || true');
          core.endGroup();
        }
        core.startGroup("Relink gcc from Homebrew");
        await bash('(brew unlink gcc && brew link gcc) || true');
        core.endGroup();
        if(input.pip)
        {
          core.startGroup("Install pip dependencies");
          await exec.exec('sudo pip install ' + input.pip);
          await exec.exec('sudo pip3 install ' + input.pip);
          core.endGroup();
        }
        if(input.github)
        {
          core.startGroup("Install macOS specific GitHub dependencies");
          await handle_github(input.github, btype, options, true);
          core.endGroup();
        }
      }
      const vcpkg = (input && input.vcpkg) || vcpkg_global;
      await handle_vcpkg(vcpkg, '');
      const github = yaml.safeLoad(core.getInput('github'));
      await handle_github(github, btype, options, true);
    }
    else
    {
      await bash('sudo rm -f /etc/apt/sources.list.d/dotnetdev.list /etc/apt/sources.list.d/microsoft-prod.list || true');
      core.exportVariable('BOOST_ROOT', '');
      core.exportVariable('BOOST_ROOT_1_69_0', '');
      const compiler = core.getInput('compiler');
      const input = yaml.safeLoad(core.getInput('ubuntu'));
      if(compiler == 'clang')
      {
        core.exportVariable('CC', 'clang');
        core.exportVariable('CXX', 'clang++');
        core.exportVariable('CCC_CXX', 'clang++');
        if(input && input.apt)
        {
          input.apt += ' clang';
        }
        else if(input)
        {
          input.apt = 'clang';
        }
      }
      else if(compiler != 'gcc')
      {
        core.warning('Compiler is set to ' + compiler + ' which is not recognized by this action');
      }
      let options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
      options += ' ' + core.getInput('options') + ' ' + core.getInput('linux-options');
      if(input)
      {
        if(input.options)
        {
          options += ' ' + input.options;
        }
        if(input.ppa)
        {
          core.startGroup("Add ppa repositories");
          await handle_ppa(input.ppa);
          core.endGroup();
        }
        core.startGroup("Update APT mirror");
        await bash('sudo apt-get update || true');
        core.endGroup();
        if(input['apt-mirrors'])
        {
          core.startGroup('Add required packages to setup mirrors');
          await exec.exec('sudo apt-get install -y apt-transport-https lsb-release ca-certificates gnupg wget curl');
          core.endGroup();
          core.startGroup('Add mirrors');
          mirrors = input['apt-mirrors'];
          for(const mname in mirrors)
          {
            const mirror = mirrors[mname];
            if(mirror.key)
            {
              await bash(`sudo apt-key adv --keyserver 'hkp://keyserver.ubuntu.com:80' --recv-key ${mirror.key}`);
            }
            else if(mirror['key-uri'])
            {
              await bash(`wget ${mirror['key-uri']} -O - | sudo apt-key add -`);
            }
            if(mirror.mirror)
            {
              await bash(`sudo sh -c 'echo "deb ${mirror.mirror} $(lsb_release -sc) main" > /etc/apt/sources.list.d/${mname}.list'`);
            }
            else if(mirror.cloudsmith)
            {
              await bash(`curl -1sLf 'https://dl.cloudsmith.io/public/${mirror.cloudsmith}/setup.deb.sh' | sudo -E bash`);
            }
            else
            {
              throw new Error(`mirror object must have either a mirror or cloudsmith key`);
            }
          }
          core.endGroup();
          core.startGroup("Update APT mirror");
          await bash('sudo apt-get update || true');
          core.endGroup();
        }
        core.startGroup('Install gfortran');
        await exec.exec('sudo apt-get install -y gfortran');
        core.endGroup();
        if(input.apt)
        {
          core.startGroup("Install APT dependencies");
          await exec.exec('sudo apt-get install -y ' + input.apt);
          core.endGroup();
        }
        if(input.pip)
        {
          core.startGroup("Install pip dependencies");
          await exec.exec('sudo pip install ' + input.pip);
          await exec.exec('sudo pip3 install ' + input.pip);
          core.endGroup();
        }
        if(input.github)
        {
          core.startGroup("Install Linux specific GitHub dependencies");
          await handle_github(input.github, btype, options, true, true);
          core.endGroup();
        }
      }
      const vcpkg = (input && input.vcpkg) || vcpkg_global;
      await handle_vcpkg(vcpkg, compiler);
      const github = yaml.safeLoad(core.getInput('github'));
      await handle_github(github, btype, options, true, true);
    }
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
