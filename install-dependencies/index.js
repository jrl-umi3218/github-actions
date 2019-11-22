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

async function build_github_repo(path, ref, btype, options, sudo)
{
  console.log('--> Cloning ' + path);
  await exec.exec('git clone --recursive --quiet https://github.com/' + path + ' ' + path)
  const cwd = process.cwd();
  io.mkdirP(path + '/build');
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
      if(input.github)
      {
        const options = '-DCMAKE_INSTALL_PREFIX=C:/devel/install -DBUILD_TESTING:BOOL=OFF';
        await handle_github(input.github, 'RelWithDebInfo', options, false);
      }
    }
    else if(process.platform === 'darwin')
    {
      const input = yaml.safeLoad(core.getInput('macos'));
      console.log('--> env');
      await exec.exec('env');
      if(input.brew)
      {
        await exec.exec('brew install ' + input.brew);
      }
      if(input.pip)
      {
        await exec.exec('sudo pip install ' + input.pip);
        await exec.exec('sudo pip3 install ' + input.pip);
      }
      if(input.github)
      {
        const options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
        await handle_github(input.github, 'RelWithDebInfo', options, true);
      }
    }
    else
    {
      const input = yaml.safeLoad(core.getInput('ubuntu'));
      console.log('--> env');
      await exec.exec('env');
      if(input.ppa)
      {
        await handle_ppa(input.ppa);
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
      if(input.github)
      {
        const options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON -DBUILD_TESTING:BOOL=OFF';
        await handle_github(input.github, 'RelWithDebInfo', options, true);
      }
    }
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
