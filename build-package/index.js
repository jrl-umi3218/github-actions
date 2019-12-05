const core = require('@actions/core');
const exec = require('@actions/exec');
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

    // See https://ubuntu.com/blog/statement-on-32-bit-i386-packages-for-ubuntu-19-10-and-20-04-lts
    if(dist == "focal" && arch == "i386")
    {
      await io.mkdirP('/tmp/packages-focal-i386');
      await bash('touch /tmp/packages-focal-i386/nothing.txt')
      return;
    }

    recipe = core.getInput("recipe");
    ros_distro = core.getInput("ros-distro");
    other_gpg_keys = core.getInput("other-gpg-keys").split(' ').filter(x => x.length != 0);
    other_mirrors = core.getInput("other-mirrors").split(' ').filter(x => x.length != 0);
    const cwd = process.cwd();
    core.startGroup("Setup cowbuilder");
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
    core.endGroup();
    core.startGroup("Build recipe");
    // Setup DEBFULLNAME
    DEBFULLNAME = process.env.DEBFULLNAME ? process.env.DEBFULLNAME : 'JRL/IDH Continuous Integration Tool';
    if(!process.env.DEBFULLNAME)
    {
      core.exportVariable('DEBFULLNAME', DEBFULLNAME);
    }
    await exec.exec('git config --global user.name "' + DEBFULLNAME + '"');
    // Setup DEBEMAIL
    DEBEMAIL = process.env.DEBEMAIL ? process.env.DEBEMAIL : 'jrl-idh+ci@gmail.com';
    if(!process.env.DEBEMAIL)
    {
      core.exportVariable('DEBEMAIL', DEBEMAIL);
    }
    await exec.exec('git config --global user.email "' + DEBEMAIL + '"');
    console.log("Using the following recipe");
    console.log("##########################");
    await bash('cat ' + recipe);
    await exec.exec('git-build-recipe --no-build --allow-fallback-to-native ' + recipe + ' /tmp/pbuilder');
    name = path.parse(recipe).name;
    process.chdir('/tmp/pbuilder/' + name);
    await exec.exec('debuild --no-tgz-check -i -I -S -uc -us -d');
    core.endGroup();
    core.startGroup("Build packages");
    await bash('sudo cowbuilder --build /tmp/pbuilder/*.dsc');
    core.endGroup();
    core.startGroup("Move packages");
    out_dir = '/tmp/packages-' + dist + '-' + arch;
    await io.mkdirP(out_dir);
    await bash('sudo mv /var/cache/pbuilder/' + dist + '-' + arch + '/result/*.deb ' + out_dir);
    core.endGroup();
    process.chdir(cwd);
  }
  catch(error)
  {
    core.setFailed(error.message);
  }
}

run();
