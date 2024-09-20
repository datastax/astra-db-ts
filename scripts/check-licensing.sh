#!/usr/bin/env sh

# Lists out all the files which don't contain the necessary license notice
find tests/ src/ -type f -exec grep -L "^// Copyright DataStax, Inc." {} +
