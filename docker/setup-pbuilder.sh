#!/bin/bash

set -e
set -x

cowbuilder --create

# Speed up pbuilder.
echo "echo \"force-unsafe-io\" > /etc/dpkg/dpkg.cfg.d/02apt-speedup" | \
    cowbuilder --login --save-after-exec

# Add ROS mirror if ROS_DISTRO is set
if [ ! -z ${ROS_DISTRO} ]; then
  echo "echo 'deb http://packages.ros.org/ros/ubuntu ${DIST} main' > /etc/apt/sources.list.d/ros-latest.list && apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key C1CF6E31E6BADE8868B172B4F42ED6FBAB17C654" | \
    cowbuilder --login --save-after-exec
fi
