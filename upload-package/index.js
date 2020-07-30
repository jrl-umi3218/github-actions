const axios = require('axios').default;
const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const io = require('@actions/io');
const yaml = require('js-yaml');
const JSON = require('JSON');

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

function validate_package(package)
{
  if(!package.name || !package.licenses || !package.vcs_url)
  {
    throw new Error("package entry must have: name, licenses and vcs_url");
  }
}

async function has_package(packages_api, package)
{
  try
  {
    await packages_api.get(package.name);
    console.log(package.name + " already exists");
    return true;
  }
  catch(error)
  {
    return false;
  }
}

async function create_package(packages_api, package)
{
  if(!await has_package(packages_api, package))
  {
    try
    {
      console.log("Attempting to create package with:\n" + JSON.stringify(package));
      await packages_api.post("", package);
    }
    catch(error)
    {
      throw new Error("Package creation failed: " + error.response.data.message);
    }
  }
}

async function cleanup_package(packages_api, content_api, package, dist, arch, version)
{
  try
  {
    files = await packages_api.get(package.name + '/versions/' + version + '/files');
    for(i = 0; i < files.data.length; i++)
    {
      f = files.data[i];
      if(f.version == version && f.path.startsWith(dist + '/' + arch))
      {
        console.log("Delete previous package: " + f.path);
        await content_api.delete(f.path);
      }
    }
  }
  catch(error)
  {
    console.log("Nothing to clean");
  }
}

function sleep(s) {
  return new Promise((resolve) => {
    setTimeout(resolve, 1000 * s);
});

async function upload_package(content_api, package, dist, arch, version, deb)
{
  console.log("Uploading " + deb + " for " + dist + "/" + arch + " (version: " + version + ")");
  const file = fs.readFileSync(deb);
  const path = package.name + '/' + version + '/' + dist + '/' + arch + '/' + deb;
  let retry = 0;
  const max_retry = 10;
  while(retry < max_retry)
  {
    try {
      await content_api.put(path + ';deb_distribution=' + dist + ';deb_component=main;deb_architecture=' + arch + ';publish=1', file);
    } catch(error) {
      retry = retry + 1;
      console.log(`Upload failed (try ${retry}/${max_retry}): ${error}`);
      await sleep(10);
    }
  }
}

async function run()
{
  try
  {
    subject = core.getInput("subject");
    repo = core.getInput("repo");
    const package = yaml.safeLoad(core.getInput("package"));
    validate_package(package);
    version = core.getInput("version");
    dist = core.getInput("dist");
    arch = core.getInput("arch");
    path = core.getInput("path");
    BINTRAY_API_KEY = core.getInput("BINTRAY_API_KEY");
    GPG_PASSPHRASE = core.getInput("GPG_PASSPHRASE");

    // See https://ubuntu.com/blog/statement-on-32-bit-i386-packages-for-ubuntu-19-10-and-20-04-lts
    if(dist == "focal" && arch == "i386")
    {
      return;
    }

    // Create REST API for Bintray
    const packages_api = axios.create({
      baseURL: 'https://api.bintray.com/packages/' + subject + '/' + repo,
      auth: {
        username: subject,
        password: BINTRAY_API_KEY
      }
    });
    const content_api = axios.create({
      baseURL: 'https://api.bintray.com/content/' + subject + '/' + repo,
      auth: {
        username: subject,
        password: BINTRAY_API_KEY
      },
      headers: {
        'X-GPG-PASSPHRASE': GPG_PASSPHRASE
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const cwd = process.cwd();

    // Check that the package exist, create it otherwise
    await create_package(packages_api, package);

    if(version === 'HEAD')
    {
      // Remove old files for this dist/arch/version combination
      await cleanup_package(packages_api, content_api, package, dist, arch, version);
    }

    // Find all deb and upload them
    process.chdir(path);
    debs = fs.readdirSync('.').filter(x => x.endsWith('.deb'));
    for(i = 0; i < debs.length; i++)
    {
      await upload_package(content_api, package, dist, arch, version, debs[i]);
    }

    process.chdir(cwd);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
