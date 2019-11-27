#!/bin/bash

set -x

DIST=$1
ARCH=$2

sudo apt-get update -qq
sudo apt-get install -qq \
        packaging-dev cowbuilder \
        debootstrap devscripts \
        git-buildpackage debian-archive-keyring unzip \
        pkg-kde-tools dput python3-setuptools python-pip python3-pip

cp -f `dirname $0`/pbuilderrc $HOME/.pbuilderrc
sed -i "s/@DIST@/${DIST}/g" $HOME/.pbuilderrc
sed -i "s/@ARCH@/${ARCH}/g" $HOME/.pbuilderrc
if [ ! -z ${ROS_DISTRO} ]; then
  sed -i "s#@ROS_SETUP@#export PKG_CONFIG_PATH=/opt/ros/${ROS_DISTRO}/lib/pkgconfig:\$PKG_CONFIG_PATH\nexport ROS_MASTER_URI=http://localhost:11311\nexport PYTHONPATH=/opt/ros/${ROS_DISTRO}/lib/python2.7/dist-packages:\$PYTHONPATH\nexport CMAKE_PREFIX_PATH=/opt/ros/${ROS_DISTRO}:\$CMAKE_PREFIX_PATH#" $HOME/.pbuilderrc
else
  sed -i "s#@ROS_SETUP@##" $HOME/.pbuilderrc
fi

sudo cowbuilder --create

# Speed up pbuilder.
echo "echo \"force-unsafe-io\" > /etc/dpkg/dpkg.cfg.d/02apt-speedup" | \
    sudo cowbuilder --login --save-after-exec

# Add ROS mirror if ROS_DISTRO is set
if [ ! -z ${ROS_DISTRO} ]; then
  echo "echo 'deb http://packages.ros.org/ros/ubuntu ${DIST} main' > /etc/apt/sources.list.d/ros-latest.list && apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key C1CF6E31E6BADE8868B172B4F42ED6FBAB17C654" | \
    sudo cowbuilder --login --save-after-exec
fi
