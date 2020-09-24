const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const yaml = require('js-yaml');
const util = require('util');

async function handle_ppa(ppas_str)
{
  const ppas = ppas_str.split(' ');
  for(let i = 0; i < ppas.length; i++)
  {
    const ppa = ppas[i];
    await exec.exec('sudo add-apt-repository -y ppa:' + ppa);
  }
}

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function handle_vcpkg(vcpkg)
{
  if(!vcpkg)
  {
    return;
  }
  if(!vcpkg.repo || !vcpkg.user || !vcpkg.token)
  {
    throw new Error('vcpkg object must have three members: repo, user and token');
  }
  core.startGroup("Remove existing installation in GitHub environment");
    await bash('rm -rf "$VCPKG_INSTALLATION_ROOT" || sudo rm -rf "$VCPKG_INSTALLATION_ROOT"');
  core.endGroup();
  core.startGroup("Bootstrap vcpkg");
    core.exportVariable('VCPKG_BINARY_SOURCES', 'clear;nuget,GitHub,readwrite');
    await exec.exec('git clone --recursive https://github.com/' + vcpkg.repo);
    const cwd = process.cwd();
    let mono = '';
    const vcpkg_org = vcpkg.repo.split('/')[0];
    const vcpkg_dir = vcpkg.repo.split('/')[1];
    const vcpkg_exe = `./${vcpkg_dir}/vcpkg`;
    process.chdir(vcpkg_dir);
    core.exportVariable('VCPKG_TOOLCHAIN', `${process.cwd()}/scripts/buildsystems/vcpkg.cmake`);
    if(process.platform == 'win32')
    {
      await bash('./bootstrap-vcpkg.bat');
      core.exportVariable('VCPKG_DEFAULT_TRIPLET', 'x64-windows');
    }
    else
    {
      mono = 'mono';
      await bash('./bootstrap-vcpkg.sh');
    }
  core.endGroup();
  core.startGroup('Setup NuGet');
    await bash(`${mono} \`./vcpkg fetch nuget | tail -n 1\` sources add -source "${vcpkg_org}" -name "GitHub" -storepasswordincleartext -username "${vcpkg.user}" -password "${vcpkg.token}"`);
  core.endGroup();
  core.startGroup('Install vcpkg dependencies');
    process.chdir(cwd);
    await bash(`${vcpkg_exe} install --debug`);
  core.endGroup();
}

async function build_github_repo(path, ref, btype, options, sudo, build_dir)
{
  core.startGroup('Building ' + path);
  core.startGroup('--> Cloning ' + path);
  await exec.exec('git clone --recursive https://github.com/' + path + ' ' + path)
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
  await exec.exec('cmake --build . --config ' + btype);
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
    core.exportVariable('CMAKE_BUILD_PARALLEL_LEVEL', 2);
    const btype = core.getInput('build-type');
    if(process.platform === 'win32')
    {
      PATH = process.env.PATH;
      let BOOST_ROOT = process.env.BOOST_ROOT ? process.env.BOOST_ROOT : "";
      if(!BOOST_ROOT.length)
      {
        BOOST_ROOT = process.env.BOOST_ROOT_1_69_0
        core.exportVariable('BOOST_ROOT', BOOST_ROOT);
      }
      const BOOST_LIB = BOOST_ROOT + '\\lib';
      if(PATH.indexOf(BOOST_LIB) == -1)
      {
        core.exportVariable('PATH', BOOST_LIB + ';' + PATH);
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
      const input = yaml.safeLoad(core.getInput('windows'));
      let options = '-DCMAKE_INSTALL_PREFIX=C:/devel/install -DBUILD_TESTING:BOOL=OFF';
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
      const vcpkg = (input && input.vcpkg) || yaml.safeLoad(core.getInput('vcpkg'));
      await handle_vcpkg(vcpkg);
      const github = yaml.safeLoad(core.getInput('github'));
      await handle_github(github, btype, options, false);
    }
    else if(process.platform === 'darwin')
    {
      const input = yaml.safeLoad(core.getInput('macos'));
      let options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
      options += ' ' + core.getInput('options') + ' ' + core.getInput('macos-options');
      if(input)
      {
        if(input.options)
        {
          options += ' ' + input.options;
        }
        if(input.cask)
        {
          core.startGroup("Install Homebrew cask dependencies");
          await exec.exec('brew cask install ' + input.cask);
          core.endGroup();
        }
        if(input.brew)
        {
          core.startGroup("Install Homebrew dependencies");
          await exec.exec('brew install ' + input.brew);
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
          core.startGroup("Install macOS specific GitHub dependencies");
          await handle_github(input.github, btype, options, true);
          core.endGroup();
        }
      }
      const vcpkg = (input && input.vcpkg && yaml.safeLoad(input.vcpkg)) || yaml.safeLoad(core.getInput('vcpkg'));
      await handle_vcpkg(vcpkg);
      const github = yaml.safeLoad(core.getInput('github'));
      await handle_github(github, btype, options, true);
    }
    else
    {
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
        await exec.exec('sudo apt-get update');
        core.endGroup();
        if(input['apt-mirrors'])
        {
          core.startGroup('Add required packages to setup mirrors');
          await exec.exec('sudo apt-get install -y apt-transport-https lsb-release ca-certificates gnupg wget');
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
            await bash(`sudo sh -c 'echo "deb ${mirror.mirror} $(lsb_release -sc) main" > /etc/apt/sources.list.d/${mname}.list'`);
          }
          core.endGroup();
          core.startGroup("Update APT mirror");
          await exec.exec('sudo apt-get update');
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
      const vcpkg = (input && input.vcpkg) || yaml.safeLoad(core.getInput('vcpkg'));
      await handle_vcpkg(vcpkg);
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
