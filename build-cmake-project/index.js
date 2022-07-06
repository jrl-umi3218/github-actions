const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const os = require('os');

const utils = require('../utils');

async function run()
{
  try
  {
    // Take care of the build options
    const btype = core.getInput('build-type');
    let options = core.getInput('options');
    let sudo = true;
    if(!process.env.VCPKG_TOOLCHAIN)
    {
      await utils.setup_boost();
    }
    // For projects that use cmake_add_fortran_subdirectory we need to hide sh from the PATH
    const OLD_PATH = process.env.PATH;
    if(process.platform === 'win32')
    {
      // Work-around https://answers.microsoft.com/en-us/windows/forum/all/i-am-getting-0xc0000135-error-when-opening-any/c80f6cd2-dcb1-4475-9e76-3edc80f86d29
      core.startGroup('Work-around Windows update issue');
      await exec.exec('dism /online /enable-feature /featurename:netfx3 /all');
      await exec.exec('dism /online /enable-feature /featurename:WCF-HTTP-Activation');
      await exec.exec('dism /online /enable-feature /featurename:WCF-NonHTTP-Activation');
      core.endGroup();
      PATH = OLD_PATH;
      while(PATH.indexOf('Git') != -1)
      {
        PATH = PATH.replace('Git', 'dummy');
      }
      // Undo this otherwise gfortran libs are hidden
      PATH.replace('C:\Program Files\dummy\mingw64\bin', 'C:\Program Files\Git\mingw64\bin');
      if(PATH.indexOf('C:\\devel\\install\\bin') == -1)
      {
        PATH = 'C:\\devel\\install\\bin;' + PATH;
      }
      core.exportVariable('PATH', PATH);
      core.startGroup("Modified PATH variable");
      console.log(PATH);
      core.endGroup();
      options = '-DCMAKE_CXX_FLAGS_INIT=\'/MP\' -DCMAKE_INSTALL_PREFIX=C:/devel/install -DBoost_USE_STATIC_LIBS=OFF ' + options;
      if(btype.toLowerCase() == 'debug')
      {
        options = options + ' -DPYTHON_BINDING:BOOL=OFF';
      }
      options = options + ' ' + core.getInput('windows-options');
      sudo = false;
    }
    else if(process.platform === 'darwin')
    {
      options = '-DPYTHON_BINDING_FORCE_PYTHON3:BOOL=ON ' + options;
      options = options + ' ' + core.getInput('macos-options');
    }
    else
    {
      LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH ? process.env.LD_LIBRARY_PATH : '';
      if(LD_LIBRARY_PATH.indexOf('/usr/local/lib') == -1)
      {
        LD_LIBRARY_PATH = '/usr/local/lib:' + LD_LIBRARY_PATH;
        core.exportVariable('LD_LIBRARY_PATH', LD_LIBRARY_PATH);
      }
      options = '-DPYTHON_BINDING_BUILD_PYTHON2_AND_PYTHON3:BOOL=ON ' + options;
      options = options + ' ' + core.getInput('linux-options');
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
    if(process.env.VCPKG_TOOLCHAIN)
    {
      core.info(`Using vcpkg toolchain file: ${process.env.VCPKG_TOOLCHAIN}`);
      options = `-DCMAKE_TOOLCHAIN_FILE=${process.env.VCPKG_TOOLCHAIN} ${options}`;
    }

    // Take care of the actual build
    core.exportVariable('CMAKE_BUILD_PARALLEL_LEVEL', os.cpus().length);
    const project_dir = core.getInput('project-dir');
    if(project_dir.length)
    {
      process.chdir(project_dir);
    }
    await io.mkdirP('build');
    process.chdir('build');
    core.startGroup('Configure');
    await exec.exec('cmake ../ ' + options);
    core.endGroup();
    core.startGroup('Build');
    let build_cmd = 'cmake --build . --config ' + btype;
    if(process.platform === 'win32')
    {
      build_cmd = build_cmd + ` -- /p:CL_MPcount=${os.cpus().length}`;
    }
    await exec.exec(build_cmd);
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
    if(process.platform === 'win32')
    {
      await exec.exec('cmake -E env CTEST_OUTPUT_ON_FAILURE=1 cmake --build . --target RUN_TESTS --config ' + btype);
    }
    else
    {
      await exec.exec('ctest -V -C ' + btype);
    }
    core.endGroup();
    core.exportVariable('PATH', OLD_PATH);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
