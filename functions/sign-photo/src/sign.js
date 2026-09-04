import { Builder, LocalSigner } from '@contentauth/c2pa-node';

/** IPTC vocabulary term for an image that came off a camera sensor. */
const DIGITAL_CAPTURE = 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture';

/**
 * The builder embeds a full-quality copy of the asset as a manifest thumbnail
 * unless told not to, which takes a 59KB photo to 590KB — ten times the size,
 * on a pipeline that downscales to 1200px precisely to avoid that. The
 * thumbnail only helps a verifier show what the image looked like when signed;
 * tamper detection comes from the hash either way. Not worth 10x.
 */
const SETTINGS = {
    builder: {
        generateC2paArchive: true,
        thumbnail: { enabled: false },
    },
};

/**
 * Embeds a signed C2PA manifest into an image.
 *
 * The manifest carries a hash of these exact bytes, so what comes back is the
 * only version that will ever validate: re-encode it anywhere downstream and
 * every verifier reports it as modified. That is precisely the property worth
 * having — and precisely why the signed bytes must be served untransformed.
 *
 * @param buffer   the image to sign
 * @param mimeType the image's type, e.g. `image/webp`
 * @param opts.certPem signing certificate, PEM
 * @param opts.keyPem  private key, PEM (PKCS#8)
 * @param opts.title   name recorded in the manifest, usually the file name
 * @param opts.creator author to name in the manifest; omitted when unknown
 * @returns the signed asset — the input buffer is left untouched
 */
export function signImage(buffer, mimeType, { certPem, keyPem, title, creator }) {
    const builder = Builder.withJson(
        {
            claim_generator_info: [{ name: 'photoframes.me', version: '1.0.0' }],
            title,
            format: mimeType,
            // schema.org is the assertion verification UIs read to show an
            // author, so a photo with no creator simply carries no attribution
            // rather than an empty one.
            ...(creator && {
                assertions: [
                    {
                        label: 'stds.schema-org.CreativeWork',
                        data: {
                            '@context': 'https://schema.org',
                            '@type': 'CreativeWork',
                            author: [{ '@type': 'Person', name: creator }],
                        },
                    },
                ],
            }),
        },
        SETTINGS,
    );

    builder.setIntent({ create: DIGITAL_CAPTURE });

    const signer = LocalSigner.newSigner(certPem, keyPem, 'es256');
    // `sign` fills the destination in place rather than returning the asset —
    // its return value is the manifest, which we have no use for here.
    const destination = { buffer: null };
    builder.sign(signer, { buffer, mimeType }, destination);

    return destination.buffer;
}
