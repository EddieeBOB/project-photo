import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';
import { fetchFeaturedArtist, getHeroPhoto } from '../services/photoService';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { colors, typography, PrimaryButton, SecondaryButton } from '../theme';

const HeroTitle = [{ title: "Frame.", subtitle: "A Home for Every Lens." }]

export default function Hero() {
    const { t } = useTranslation();
    const [artistData, setArtistData] = useState<{ name: string, title: string, imageUrl: string | null } | null>(null);

    useEffect(() => {
        let isMounted = true;
        async function loadFeaturedArtist() {
            const data = await fetchFeaturedArtist();
            if (isMounted && data) {
                setArtistData(data);
            }
        }
        loadFeaturedArtist();
        return () => { isMounted = false; };
    }, []);

    return (
        <Box sx={{ pt: { xs: 16, md: 24 }, pb: { xs: 8, md: 16 } }}>
            <Container maxWidth="lg" sx={{ px: { xs: 3, md: 6 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: 'center',
                        gap: { xs: 6, md: 12 }
                    }}
                >
                    {/* Left side: Text Content */}
                    <Box sx={{ flex: 1 }}>
                        <Typography
                            variant="h1"
                            sx={{
                                fontFamily: typography.headline,
                                fontSize: { xs: '48px', md: '64px' },
                                fontWeight: 300,
                                color: colors.text,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.1,
                                mb: 3,
                                whiteSpace: { md: 'nowrap' }
                            }}
                        >
                            {HeroTitle[0].title} <br /> {HeroTitle[0].subtitle}
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontFamily: typography.ui,
                                fontSize: '18px',
                                color: colors.textSecondary,
                                lineHeight: 1.6,
                                mb: 6,
                                maxWidth: 'auto'
                            }}
                        >
                            {t('hero.description')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <PrimaryButton disableRipple>{t('hero.exploreGallery')}</PrimaryButton>
                            <SecondaryButton disableRipple>{t('hero.readJournal')}</SecondaryButton>
                        </Box>
                    </Box>

                    {/* Right side: Visual */}
                    <Box sx={{ flex: 1, position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <Box sx={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
                            <Box
                                sx={{
                                    width: '100%',
                                    aspectRatio: '4/5',
                                    backgroundColor: colors.borderLight,
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 24px 48px rgba(0,0,0,0.08)',
                                    overflow: 'hidden'
                                }}
                            >
                                <img
                                    src={artistData?.imageUrl || getHeroPhoto()}
                                    alt="Luminous Gallery Interior"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            </Box>

                            {/* Featured Artist Card */}
                            {artistData && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        bottom: { xs: -24, md: -32 },
                                        left: { xs: 16, md: -64 },
                                        backgroundColor: colors.onPrimary,
                                        padding: '24px 32px',
                                        boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
                                        zIndex: 10,
                                        border: `1px solid ${colors.borderLight}`,
                                        maxWidth: '280px',
                                        width: '100%'
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontFamily: typography.ui,
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            letterSpacing: '0.1em',
                                            textTransform: 'uppercase',
                                            color: colors.textSecondary,
                                            mb: 1.5
                                        }}
                                    >
                                        {t('hero.featuredArtist')}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontFamily: typography.headline,
                                            fontSize: '24px',
                                            color: colors.text,
                                            mb: 1
                                        }}
                                    >
                                        {artistData.name}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontFamily: typography.ui,
                                            fontSize: '14px',
                                            color: colors.textSecondary,
                                            fontStyle: 'italic',
                                            lineHeight: 1.5
                                        }}
                                    >
                                        {artistData.title}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
