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

async function build_github_repo(path, ref, btype, options, sudo)
{
  console.log('--> Cloning ' + path);
  await exec.exec('git clone --recursive https://github.com/' + path + ' ' + path)
  const cwd = process.cwd();
  await io.mkdirP(path + '/build');
  process.chdir(path + '/build');
  console.log('--> Configure ' + path);
  await exec.exec('cmake ../ -DCMAKE_BUILD_TYPE=' + btype + ' ' + options);
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

async function handle_github(github, btype, options, sudo)
{
  for(let i = 0; i < github.length; ++i)
  {
    const entry = github[i];
    ref = "master";
    if(entry.ref)
    {
      ref = entry.ref;
    }
    if(entry.options)
    {
      options = options + " " + entry.options;
    }
    await build_github_repo(entry.path, ref, btype, options, sudo);
  }
}

async function run()
{
  try
  {
    const btype = core.getInput('build-type');
    if(process.platform === 'win32')
    {
      const input = yaml.safeLoad(core.getInput('windows'));
      if(input.choco)
      {
        await exec.exec('choco install ' + input.choco + ' -y');
      }
      if(input.pip)
      {
        await exec.exec('pip install ' + input.pip);
      }
      let options = '-DCMAKE_INSTALL_PREFIX=C:/devel/install -DBUILD_TESTING:BOOL=OFF';
      if(btype.toLowerCase() == 'debug')
      {
        options = options + ' -DPYTHON_BINDING:BOOL=OFF';
      }
      if(input.github)
      {
        await handle_github(input.github, btype, options, false);
      }
      const github = core.getInput('github');
      await handle_github(github, btype, options, false);
    }
    else if(process.platform === 'darwin')
    {
      const input = yaml.safeLoad(core.getInput('macos'));
      if(input.brew)
      {
        await exec.exec('brew install ' + input.brew);
      }
      if(input.pip)
      {
        await exec.exec('sudo pip install ' + input.pip);
        await exec.exec('sudo pip3 install ' + input.pip);
      }
      const options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
      if(input.github)
      {
        await handle_github(input.github, btype, options, true);
      }
      const github = core.getInput('github');
      await handle_github(github, btype, options, true);
    }
    else
    {
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
        await handle_ppa(input.ppa);
      }
      else
      {
        await exec.exec('sudo apt-get update');
      }
      if(input.apt)
      {
        await exec.exec('sudo apt-get install -y ' + input.apt);
      }
      if(input.pip)
      {
        await exec.exec('sudo pip install ' + input.pip);
        await exec.exec('sudo pip3 install ' + input.pip);
      }
      const options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
      if(input.github)
      {
        await handle_github(input.github, btype, options, true);
      }
      const github = core.getInput('github');
      await handle_github(github, btype, options, true);
    }
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
