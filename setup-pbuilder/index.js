const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');

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
    other_gpg_keys = core.getInput("other-gpg-keys").split(' ').filter(x => x.length != 0);
    other_mirrors = core.getInput("other-mirrors").split(' ').filter(x => x.length != 0);
    const cwd = process.cwd();
    process.chdir(__dirname);
    if(ros_distro != '')
    {
      core.exportVariable('ROS_DISTRO', ros_distro);
    }
    await bash('./setup-pbuilder.sh ' + dist + ' ' + arch);
    commands = [
      other_gpg_keys.map(x => 'apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key ' + x).join(' && '),
      other_mirrors.map(x => "echo 'deb " + x + " " + dist + " main' | tee -a /etc/apt/sources.list").join(' && ')
    ].filter(x => x.length != 0).join(' && ');
    if(commands.length != 0)
    {
      await bash('echo "' + commands + '" | sudo cowbuilder --login --save-after-exec');
      await bash('sudo cowbuilder --update');
    }
    process.chdir(cwd);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
