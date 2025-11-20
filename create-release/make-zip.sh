#!/bin/bash

set -x

if [ ! -x "$(command -v zipmerge)" ]; then
  sudo apt-get -qq update && sudo apt-get -qq install zipmerge
fi

REPO_DIR=$(realpath "$1")
PROJECT_NAME=$2
TAG=$3
OUT=$(pwd)/$PROJECT_NAME.zip

cd $REPO_DIR
PREFIX=$PROJECT_NAME-$TAG
git submodule update --init --recursive
git archive --verbose --prefix "$PREFIX/" --format "zip" --output "main.zip" HEAD
git submodule foreach --recursive "git archive --verbose --prefix=\"${PREFIX}/\$path/\" --format zip HEAD --output $REPO_DIR/repo-output-sub-\$sha1.zip"
zipmerge $OUT main.zip repo-output-*.zip || zipmerge $OUT main.zip
rm -f main.zip repo-output*.zip
