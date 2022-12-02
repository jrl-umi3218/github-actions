const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const io = require('@actions/io');
const path = require('path');

async function bash(cmd)
{
  await exec.exec('bash', ['-c', cmd]);
}

async function run()
{
  try
  {
    dist = core.getInput("dist");
    arch = core.getInput("arch");
    ros_distro = core.getInput("ros-distro");
    cloudsmith_repo = core.getInput("cloudsmith-repo");
    other_gpg_keys = core.getInput("other-gpg-keys").split(' ').filter(x => x.length != 0);
    other_mirrors = core.getInput("other-mirrors").split(' ').filter(x => x.length != 0);
    latest_cmake = core.getBooleanInput("latest-cmake");

    const context = github.context;
    const repo = context.repo.repo;
    core.exportVariable('REPO', repo);

    const cwd = process.cwd();
    process.chdir(__dirname);

    tag = dist + '-' + arch
    core.exportVariable('PACKAGES_TAG', tag);
    if(ros_distro != '')
    {
      tag += '-' + ros_distro;
    }
    core.exportVariable('DOCKER_TAG', tag);

    if(cloudsmith_repo.length)
    {
      cloudsmith_repo = `curl -1sLf 'https://dl.cloudsmith.io/public/${cloudsmith_repo}/setup.deb.sh' | bash`
    }

    let latest_cmake_cmd = '';
    if(latest_cmake)
    {
      latest_cmake_cmd = "wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | tee /usr/share/keyrings/kitware-archive-keyring.gpg >/dev/null \\&\\& echo 'deb [signed-by=/usr/share/keyrings/kitware-archive-keyring.gpg] https://apt.kitware.com/ubuntu/ " + dist + " main' | tee /etc/apt/sources.list.d/kitware.list >/dev/null";
    }

    commands = [
      cloudsmith_repo,
      latest_cmake_cmd,
      other_gpg_keys.map(x => 'apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key ' + x).join(' \\&\\& '),
      other_mirrors.map(x => "echo 'deb " + x + " " + dist + " main' | tee -a /etc/apt/sources.list").join(' \\&\\& ')
    ].filter(x => x.length != 0).join(' \\&\\& ');
    if(commands.length != 0)
    {
      core.exportVariable('EXTRA_SETUP_COMMANDS', commands);
    }

    // Setup DEBFULLNAME
    DEBFULLNAME = process.env.DEBFULLNAME ? process.env.DEBFULLNAME : 'JRL/IDH Continuous Integration Tool';
    if(!process.env.DEBFULLNAME)
    {
      core.exportVariable('DEBFULLNAME', DEBFULLNAME);
    }

    // Setup DEBEMAIL
    DEBEMAIL = process.env.DEBEMAIL ? process.env.DEBEMAIL : 'jrl-idh+ci@gmail.com';
    if(!process.env.DEBEMAIL)
    {
      core.exportVariable('DEBEMAIL', DEBEMAIL);
    }

    await bash("./docker-and-build.sh");

    process.chdir(cwd);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
