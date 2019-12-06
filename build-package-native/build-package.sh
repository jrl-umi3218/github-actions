#!/bin/bash

@EXTRA_SETUP_COMMANDS@
mk-build-deps -i -r -t "apt-get -y" /tmp/package/@REPO@/debian/control
cd /package/@REPO@
debuild --no-tgz-check -i -I -b -us -uc
