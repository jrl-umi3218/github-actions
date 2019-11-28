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

async function build_github_repo(path, ref, btype, options, sudo, build_dir)
{
  console.log('--> Cloning ' + path);
  await exec.exec('git clone --recursive https://github.com/' + path + ' ' + path)
  const cwd = process.cwd();
  const project_path = cwd + '/' + path;
  await io.mkdirP(build_dir);
  process.chdir(build_dir);
  console.log('--> Configure ' + path);
  await exec.exec('cmake ' + project_path + ' -DCMAKE_BUILD_TYPE=' + btype + ' ' + options);
  console.log('--> Building ' + path);
  await exec.exec('cmake --build . --config ' + btype);
  console.log('--> Install ' + path);
  if(sudo)
  {
    await exec.exec('sudo cmake --build . --target install --config ' + btype);
  }
  else
  {
    await exec.exec('cmake --build . --target install --config ' + btype);
  }
  process.chdir(cwd);
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
    if(entry.options)
    {
      options = options + " " + entry.options;
    }
    build_dir = linux ? '/tmp/_ci/build/' + entry.path : entry.path + '/build';
    await build_github_repo(entry.path, ref, btype, options, sudo, build_dir);
  }
  core.exportVariable('GIT_DEPENDENCIES', GIT_DEPENDENCIES.trim());
  core.endGroup();
}

async function run()
{
  try
  {
    const btype = core.getInput('build-type');
    if(process.platform === 'win32')
    {
      PATH = process.env.PATH;
      const BOOST_LIB = process.env.BOOST_ROOT + '\\lib';
      if(PATH.indexOf(BOOST_LIB) == -1)
      {
        core.exportVariable('PATH', BOOST_LIB + ';' + PATH);
      }
      const input = yaml.safeLoad(core.getInput('windows'));
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
      let options = '-DCMAKE_INSTALL_PREFIX=C:/devel/install -DBUILD_TESTING:BOOL=OFF';
      if(btype.toLowerCase() == 'debug')
      {
        options = options + ' -DPYTHON_BINDING:BOOL=OFF';
      }
      // For projects that use cmake_add_fortran_subdirectory we need to hide sh from the PATH
      const OLD_PATH = process.env.PATH;
      PATH = OLD_PATH;
      while(PATH.indexOf('Git') != -1)
      {
        PATH = PATH.replace('Git', 'dummy');
      }
      core.exportVariable('PATH', PATH);
      core.startGroup("Modified PATH variable");
      console.log(PATH);
      core.endGroup();
      if(input.github)
      {
        core.startGroup("Install Windows specific GitHub dependencies");
        await handle_github(input.github, btype, options, false);
        core.endGroup();
      }
      const github = yaml.safeLoad(core.getInput('github'));
      await handle_github(github, btype, options, false);
      // Restore PATH setting
      core.exportVariable('PATH', OLD_PATH);
    }
    else if(process.platform === 'darwin')
    {
      const input = yaml.safeLoad(core.getInput('macos'));
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
      const options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
      if(input.github)
      {
        core.startGroup("Install macOS specific GitHub dependencies");
        await handle_github(input.github, btype, options, true);
        core.endGroup();
      }
      const github = yaml.safeLoad(core.getInput('github'));
      await handle_github(github, btype, options, true);
    }
    else
    {
      core.exportVariable('BOOST_ROOT', '');
      core.exportVariable('BOOST_ROOT_1_69_0', '');
      const input = yaml.safeLoad(core.getInput('ubuntu'));
      const compiler = core.getInput('compiler');
      if(compiler == 'clang')
      {
        core.exportVariable('CC', 'clang');
        core.exportVariable('CXX', 'clang++');
        core.exportVariable('CCC_CXX', 'clang++');
        if(input.apt)
        {
          input.apt += ' clang';
        }
        else
        {
          input.apt = 'clang';
        }
      }
      else if(compiler != 'gcc')
      {
        core.warning('Compiler is set to ' + compiler + ' which is not recognized by this action');
      }
      if(input.ppa)
      {
        core.startGroup("Add ppa repositories");
        await handle_ppa(input.ppa);
        core.endGroup();
      }
      else
      {
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
      const options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
      if(input.github)
      {
        core.startGroup("Install Linux specific GitHub dependencies");
        await handle_github(input.github, btype, options, true, true);
        core.endGroup();
      }
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
