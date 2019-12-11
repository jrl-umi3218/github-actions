const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const io = require('@actions/io');
const fs = require('fs');

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function bash_output(cmd)
{
  let out = '';
  const options = {};
  options.listeners = {
    stdout: data => {
      out += data.toString();
    }
  };
  await exec.exec('bash', ['-c', cmd], options)
  return out;
}

async function run()
{
  try
  {
    const github = require('@actions/github');
    const context = github.context;
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const octokit = new github.GitHub(core.getInput('GITHUB_TOKEN'));
    const tag = core.getInput('tag');
    const name = 'Release v' + tag;
    const body = await bash_output('git log -1 --pretty=%B | tail -n +2');
    const release = await octokit.repos.createRelease({owner: owner, repo: repo, tag_name: tag, draft: true});
    const release_id = release.data.id;
    const upload_url = release.data.upload_url;
    const cwd = process.cwd();
    process.chdir(__dirname);

    await bash('./make-tar-gz.sh ' + process.env.GITHUB_WORKSPACE + ' ' + repo + ' ' + tag);
    const tar_gz = fs.readFileSync(repo + '.tar.gz');
    const tar_gz_name = repo + '-' + tag + '.tar.gz';
    await octokit.repos.uploadReleaseAsset({file: tar_gz, headers: { 'content-length': tar_gz.length, 'content-type': 'application/gzip'}, name: tar_gz_name, url: upload_url});

    await bash('./make-zip.sh ' + process.env.GITHUB_WORKSPACE + ' ' + repo + ' ' + tag);
    const zip = fs.readFileSync(repo + '.zip');
    const zip_name = repo + '-' + tag + '.zip';
    await octokit.repos.uploadReleaseAsset({file: zip, headers: { 'content-length': zip.length, 'content-type': 'application/zip'}, name: zip_name, url: upload_url});

    process.chdir(cwd);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
