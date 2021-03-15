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
    await exec.exec('powershell.exe', ['./get-boost.ps1']);
    BOOST_ROOT = "C:\\hostedtoolcache\\windows\\Boost\\1.72.0\\x86_64";
    core.exportVariable('BOOST_ROOT', BOOST_ROOT);
  }
  PATH = process.env.PATH;
  const BOOST_LIB = BOOST_ROOT + '\\lib';
  if(PATH.indexOf(BOOST_LIB) == -1)
  {
    core.exportVariable('PATH', BOOST_LIB + ';' + PATH);
  }
}

exports = {
  setup_boost
};
