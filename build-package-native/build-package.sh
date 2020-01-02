#!/bin/bash

install-project-dependencies()
{
  apt-get update -qq
  mk-build-deps -i -r -t "apt-get -y" /package/@REPO@/debian/control
}

@EXTRA_SETUP_COMMANDS@
install-project-dependencies
while [ $? -ne 0 ]
do
  echo "Failed to install project dependencies, maybe a mirror sync is running? Trying again in 5 minutes"
  sleep 5m
  install-project-dependencies
done
cd /package/@REPO@
PKG_SHA=`git rev-parse --short HEAD`
PKG_DATE=`date +"%Y%m%d%H%M%S"`
dch -l -$PKG_DATE-$PKG_SHA --distribution `lsb_release -sc` "Automated release"
debuild --no-tgz-check -i -I -b -us -uc
