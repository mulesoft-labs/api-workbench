# API Workbench Atom Plugin for RAML Server Prototype


This repository branch contains contains the source code for the API Workbench plugin prototype, which serves as a client for API Language Server.

## Build Developer Version Guide

Set up ALS server as described in https://github.com/mulesoft/als

Build JS artifact:

```sbt buildJS```

Inside als server folder move to:

```cd als/js/target/api-language-server/```
```npm install```
```npm link```

Clone amf-language-server branch of api workbench by:

```git clone --single-branch -b amf-language-server https://github.com/mulesoft/api-workbench.git```
```cd api-workbench```

To link built server:

```npm link api-language-server```
```apm install```
```gulp build```
```apm link```

launch atom

If there is a red bug icon in the bottom-right corner of the screen, click it and then click "rebuild packages", this happens sometimes if fs native package was previously compiled on this OS. Click "restart atom".

Accept all pop-ups in the top-right corner regarding dependencies installation.
