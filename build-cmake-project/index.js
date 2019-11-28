const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');

async function run()
{
  try
  {
    // Take care of the build options
    const btype = core.getInput('build-type');
    let options = core.getInput('options');
    let sudo = true;
    // For projects that use cmake_add_fortran_subdirectory we need to hide sh from the PATH
    const OLD_PATH = process.env.PATH;
    if(process.platform === 'win32')
    {
      PATH = OLD_PATH.replace('Git', 'dummy');
      const BOOST_LIB = process.env.BOOST_ROOT + '\\lib';
      if(PATH.indexOf(BOOST_LIB) == -1)
      {
        PATH = BOOST_LIB + ';' + PATH;
      }
      core.exportVariable('PATH', PATH);
      options = '-DCMAKE_INSTALL_PREFIX=C:/devel/install ' + options;
      if(btype.toLowerCase() == 'debug')
      {
        options = options + ' -DPYTHON_BINDING:BOOL=OFF';
      }
      sudo = false;
    }
    else if(process.platform === 'darwin')
    {
      options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON ' + options;
    }
    else
    {
      options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON ' + options;
      const compiler = core.getInput('compiler');
      if(compiler == 'clang')
      {
        core.exportVariable('CC', 'clang');
        core.exportVariable('CXX', 'clang++');
        core.exportVariable('CCC_CXX', 'clang++');
      }
      else if(compiler != 'gcc')
      {
        core.warning('Compiler is set to ' + compiler + ' which is not recognized by this action');
      }
    }
    options = options + ' -DCMAKE_BUILD_TYPE=' + btype;

    // Take care of the actual build
    const cwd = process.cwd();
    await io.mkdirP('build');
    process.chdir('build');
    core.startGroup('Configure');
    await exec.exec('cmake ../ ' + options);
    core.endGroup();
    core.startGroup('Build');
    await exec.exec('cmake --build . --config ' + btype);
    core.endGroup();
    core.startGroup('Install');
    let install_cmd = 'cmake --build . --target install --config ' + btype;
    if(sudo)
    {
      install_cmd = 'sudo ' + install_cmd;
    }
    await exec.exec(install_cmd);
    core.endGroup();
    core.startGroup('Test')
    await exec.exec('ctest -C ' + btype);
    core.endGroup();
    core.exportVariable('PATH', OLD_PATH);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
