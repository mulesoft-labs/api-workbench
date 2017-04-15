# API Workbench Atom Plugin for RAML Server Prototype



![API Workbench](https://dl.dropboxusercontent.com/u/497895/__permalinks/api-workbench-slide-small.png)

This repository branch contains contains the source code for the API Workbench plugin prototype, which serves as a client for RAML Server.

## Installation Guide

Dependencies:

* Atom ([Installation Guide](http://flight-manual.atom.io/getting-started/sections/installing-atom/))


Do uninstall mainstream api-workbench package in Atom preferences, if installed.

```
git clone -b api-workbench-server --single-branch https://github.com/mulesoft/api-workbench.git

cd api-workbench

apm install

npm build

apm link
```
