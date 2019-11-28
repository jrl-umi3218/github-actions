#!/bin/bash

set -x

REPO_DIR=$1
PROJECT_NAME=$2
TAG=$3
OUT=`pwd`/$PROJECT_NAME.tar

cd $REPO_DIR
PREFIX=$PROJECT_NAME-$TAG
git archive --verbose --prefix "$PREFIX/" --format "tar" --output "$OUT" HEAD
git submodule foreach --recursive "git archive --verbose --prefix=\"${PREFIX}/\$path/\" --format tar HEAD --output $REPO_DIR/repo-output-sub-\$sha1.tar"
if [[ $(ls repo-output-sub*.tar | wc -l) != 0 ]]; then
  tar --concatenate --file $OUT repo-output-sub*.tar
  rm -f repo-output-sub*.tar
fi
gzip --force --verbose $OUT
rm -f $OUT
