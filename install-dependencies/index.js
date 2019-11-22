const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');
const util = require('util');

async function run()
{
  try
  {
    if(process.platform === 'win32')
    {
      const input = core.getInput('windows');
      process.stdout.write(input);
    }
    else if(process.platform === 'darwin')
    {
      const input = core.getInput('macos');
      process.stdout.write(input);
    }
    else
    {
      const input = core.getInput('ubuntu');
      process.stdout.write(input);
    }
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
