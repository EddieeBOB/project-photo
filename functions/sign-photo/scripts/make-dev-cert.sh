#!/usr/bin/env bash
# Generates an ES256 signing identity for local development.
#
# Two certificates, not one: c2pa rejects a self-signed leaf outright ("the
# certificate is invalid"), so this makes a throwaway root CA and issues the
# signing certificate from it. Verifiers will still flag the signer as
# untrusted — nobody has heard of this root — but the manifest validates.
# For a trusted badge the leaf must be issued by a CA on the C2PA trust list,
# which changes nothing in the code, only the two function variables.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .certs
cd .certs

# --- root CA -----------------------------------------------------------
openssl ecparam -name prime256v1 -genkey -noout -out ca.sec1.key
openssl pkcs8 -topk8 -nocrypt -in ca.sec1.key -out ca.key
rm ca.sec1.key

cat > ca.cnf <<'EOF'
[req]
distinguished_name = dn
prompt = no
x509_extensions = v3_ca

[dn]
CN = photoframes.me Development Root CA
O = photoframes.me

[v3_ca]
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
EOF

openssl req -new -x509 -key ca.key -out ca.pem -days 3650 -config ca.cnf

# --- signing key and certificate ---------------------------------------
# c2pa-rs reads PKCS#8, not the SEC1 form `ecparam` emits.
openssl ecparam -name prime256v1 -genkey -noout -out private.sec1.key
openssl pkcs8 -topk8 -nocrypt -in private.sec1.key -out private.key
rm private.sec1.key

cat > csr.cnf <<'EOF'
[req]
distinguished_name = dn
prompt = no

[dn]
CN = photoframes.me
O = photoframes.me
EOF

openssl req -new -key private.key -out leaf.csr -config csr.cnf

# C2PA requires exactly these extensions on the signing certificate; without
# them signing fails with an error that never mentions extensions.
cat > leaf.ext <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=emailProtection
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req -in leaf.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -out leaf.pem -days 3650 -sha256 -extfile leaf.ext

# The signer wants the chain, leaf first.
cat leaf.pem ca.pem > certificate.pem
rm leaf.csr leaf.ext csr.cnf ca.cnf

echo "Wrote .certs/certificate.pem (leaf + root) and .certs/private.key"
