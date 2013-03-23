component-ssh-proxy-install - Proxy ssh over http locally
=========================================================

This is a hack to allow for private repos to be installed without exposing any
passwords on your local system. It will utilize ssh git checkouts on your
system in order to make it work. For now it only works with github. Other
repository containers to come soon.

Using
-----

Usage is almost identical to ``component install`` just with a different
invocation. In order to use run the following command::
    
    component ssh-proxy-install

Any options you pass will be passed to ``component install``

How it works
------------

It works by checking out all of your repos to a directory
``.components-priv-repos`` and serving those using a simple express app. It
will update the repos if necessary.

It serves the repos using the same interface as ``raw.github.com``.
