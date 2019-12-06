#!/bin/bash

@EXTRA_SETUP_COMMANDS@
apt-get update -qq
mk-build-deps -i -r -t "apt-get -y" /package/@REPO@/debian/control
cd /package/@REPO@
debuild --no-tgz-check -i -I -b -us -uc
