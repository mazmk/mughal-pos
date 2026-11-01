#!/bin/bash

# electron-builder's default after-install, plus the AppArmor profile below.
# electron-builder fills in every braced value here at build time, so write
# shell variables as $NAME, without braces.

if type update-alternatives 2>/dev/null >&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

# Check if user namespaces are supported by the kernel and working with a quick test:
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    # Use SUID chrome-sandbox only on systems without user namespaces:
    chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
else
    chmod 0755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
fi

# Ubuntu 24.04+ blocks unprivileged user namespaces unless an AppArmor profile
# allows them, and Electron's sandbox needs one: without this the app crashes on
# launch. Older AppArmor (Ubuntu 22.04) can't parse abi/4.0 and doesn't need the
# profile, so it is only installed when it parses.
if apparmor_status --enabled >/dev/null 2>&1; then
    APPARMOR_DRAFT="$(mktemp)"
    cat > "$APPARMOR_DRAFT" <<'PROFILE'
abi <abi/4.0>,
include <tunables/global>

profile ${executable} "/opt/${sanitizedProductName}/${executable}" flags=(unconfined) {
  userns,

  include if exists <local/${executable}>
}
PROFILE

    if apparmor_parser --skip-kernel-load --debug "$APPARMOR_DRAFT" >/dev/null 2>&1; then
        cp -f "$APPARMOR_DRAFT" '/etc/apparmor.d/${executable}'
        chmod 0644 '/etc/apparmor.d/${executable}'
        # Loading a profile makes no sense when building a chroot image.
        if ! { [ -x /usr/bin/ischroot ] && /usr/bin/ischroot; }; then
            apparmor_parser --replace --write-cache --skip-read-cache '/etc/apparmor.d/${executable}' || true
        fi
    fi
    rm -f "$APPARMOR_DRAFT"
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
