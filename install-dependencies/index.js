const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const yaml = require('js-yaml');
const util = require('util');

async function run()
{
  try
  {
    if(process.platform === 'win32')
    {
      const input = yaml.safeLoad(core.getInput('windows'));
      console.log(JSON.stringify(input, null, 4));
    }
    else if(process.platform === 'darwin')
    {
      const input = yaml.safeLoad(core.getInput('macos'));
      console.log(JSON.stringify(input, null, 4));
    }
    else
    {
      const input = yaml.safeLoad(core.getInput('ubuntu'));
      console.log(JSON.stringify(input, null, 4));
    }
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
