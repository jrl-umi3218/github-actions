#!/bin/bash

set -e
set -x

DIST=$1
ARCH=$2

apt-get update -qq
apt-get install -qq \
        packaging-dev cowbuilder git-build-recipe \
        debootstrap devscripts ubuntu-dev-tools \
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
