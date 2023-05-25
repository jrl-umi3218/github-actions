const core = require('@actions/core');
const exec = require('@actions/exec');

async function setup_boost()
{
  if(process.platform != 'win32')
  {
    return;
  }
  let BOOST_ROOT = process.env.BOOST_ROOT ? process.env.BOOST_ROOT : "";
  if(!BOOST_ROOT.length)
  {
    await exec.exec('powershell.exe', [`${__dirname}\\get-boost.ps1`]);
    BOOST_ROOT = "C:\\hostedtoolcache\\windows\\Boost\\1.77.0\\x86_64";
    core.exportVariable('BOOST_ROOT', BOOST_ROOT);
  }
  PATH = process.env.PATH;
  const BOOST_LIB = BOOST_ROOT + '\\lib64-msvc-14.2';
  if(PATH.indexOf(BOOST_LIB) == -1)
  {
    core.exportVariable('PATH', BOOST_LIB + ';' + PATH);
  }
}

async function bash_output(cmd)
{
  let output = '';
  const options = {};
  options.silent = true;
  options.listeners = {
    stdout: (data) => {
      output += data.toString();
    }
  };
  await exec.exec('bash', ['-c', cmd], options);
  return output.trim();
}

async function get_dist_name()
{
  return bash_output('lsb_release -sc');
}

async function distro_has_python2_and_python3()
{
  let dist_name = await get_dist_name();
  if(dist_name == 'bionic')
  {
    return true;
  }
  if(dist_name == 'focal')
  {
    return true;
  }
  return false;
}

exports.bash_output = bash_output;
exports.distro_has_python2_and_python3 = distro_has_python2_and_python3;
exports.get_dist_name = get_dist_name;
exports.setup_boost = setup_boost;
