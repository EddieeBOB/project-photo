import Box from '@mui/material/Box';

/**
 * The full-height photograph beside the login and signup forms.
 *
 * Decorative, so it carries an empty `alt` and is dropped entirely below `md`
 * rather than squeezed above the form.
 */
export default function AuthSideImage({ src }: { src: string }) {
    return (
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' }, position: 'relative' }}>
            <img
                src={src}
                alt=""
                width={1200}
                height={1600}
                loading="lazy"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
            />
        </Box>
    );
}
