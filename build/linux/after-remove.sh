#!/bin/bash

# electron-builder's default after-remove, plus removing the AppArmor profile
# that after-install.sh added.

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/usr/bin/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

rm -f '/etc/apparmor.d/${executable}'
