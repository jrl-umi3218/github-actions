const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const io = require('@actions/io');

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function run()
{
  try
  {
    const GH_USER = core.getInput('GH_USER');
    const GH_PAGES_TOKEN = core.getInput('GH_PAGES_TOKEN');
    const GH_REPOSITORY = github.context.repo.owner + '/' + github.context.repo.repo;
    const cwd = process.cwd();
    process.chdir(__dirname);
    await bash('./upload-documentation.sh ' + GH_USER + ' ' + GH_PAGES_TOKEN + ' ' + GH_REPOSITORY);
    process.chdir(cwd);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
