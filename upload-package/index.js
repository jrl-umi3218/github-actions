const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function run()
{
  try
  {
    repo = core.getInput("repo");
    dist = core.getInput("dist");
    path = core.getInput("path");
    CLOUDSMITH_API_KEY = core.getInput("CLOUDSMITH_API_KEY");

    // See https://ubuntu.com/blog/statement-on-32-bit-i386-packages-for-ubuntu-19-10-and-20-04-lts
    if(dist == "focal" && arch == "i386")
    {
      return;
    }

    // Install cloudsmith cli
    await bash('pip3 install --upgrade setuptools');
    await bash('pip3 install --upgrade wheel');
    await bash('pip3 install --upgrade cloudsmith-cli');

    // Find all deb and upload them
    const cwd = process.cwd();
    process.chdir(path);
    debs = fs.readdirSync('.').filter(x => x.endsWith('.deb'));
    for(i = 0; i < debs.length; i++)
    {
      await bash(`cloudsmith push deb -k ${CLOUDSMITH_API_KEY} --republish ${repo}/${dist} ${debs[i]}`);
    }

    process.chdir(cwd);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
