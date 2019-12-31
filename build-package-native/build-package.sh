#!/bin/bash

@EXTRA_SETUP_COMMANDS@
apt-get update -qq
mk-build-deps -i -r -t "apt-get -y" /package/@REPO@/debian/control
cd /package/@REPO@
PKG_SHA=`git rev-parse --short HEAD`
PKG_DATE=`date +"%Y%m%d%H%M%S"`
dch -l -$PKG_DATE-$PKG_SHA --distribution `lsb_release -sc` "Automated release"
debuild --no-tgz-check -i -I -b -us -uc
