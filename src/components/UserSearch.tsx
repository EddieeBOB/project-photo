import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { colors, typography } from '../theme';
import { searchUsersByUsername, type UserSearchResult } from '../services/userService';
import { SearchIcon } from './icons';

/** How long typing must pause before a search fires. */
const DEBOUNCE_MS = 250;

interface UserSearchProps {
    /** Called once a photographer is picked — lets the mobile drawer close itself. */
    onSelect?: () => void;
    /** Stretch to fill the container instead of sitting at its fixed navbar width. */
    fullWidth?: boolean;
}

/**
 * Navbar search for photographers with a public gallery.
 *
 * Matching is prefix-only: "ed" finds "EddieeBOB", "bob" does not.
 */
export default function UserSearch({ onSelect, fullWidth = false }: UserSearchProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [inputValue, setInputValue] = React.useState('');
    const [options, setOptions] = React.useState<UserSearchResult[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    /** The term `options` currently reflects, so the debounce gap doesn't read as "no results". */
    const [settledTerm, setSettledTerm] = React.useState('');

    const term = inputValue.trim();
    const pending = loading || term !== settledTerm;

    React.useEffect(() => {
        // `cancelled` covers both the debounce and the request itself: when the
        // term changes mid-flight, the older run stops before it can overwrite
        // newer results with a late response.
        let cancelled = false;

        const timer = setTimeout(async () => {
            if (!term) {
                if (!cancelled) {
                    setOptions([]);
                    setLoading(false);
                    setSettledTerm('');
                }
                return;
            }

            if (!cancelled) setLoading(true);
            try {
                const results = await searchUsersByUsername(term);
                if (!cancelled) setOptions(results);
            } catch {
                // Searching is incidental to the page; a failure shows no
                // matches rather than interrupting the user.
                if (!cancelled) setOptions([]);
            } finally {
                if (!cancelled) {
                    setSettledTerm(term);
                    setLoading(false);
                }
            }
        }, term ? DEBOUNCE_MS : 0);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [term]);

    const handleSelect = (_event: React.SyntheticEvent, option: UserSearchResult | null) => {
        if (!option) return;
        setInputValue('');
        setOptions([]);
        setOpen(false);
        navigate(`/user/${encodeURIComponent(option.username)}`);
        onSelect?.();
    };

    return (
        <Autocomplete<UserSearchResult>
            options={options}
            // The prefix query already filtered server-side; skip MUI's own pass
            // so it can't hide valid matches.
            filterOptions={(x) => x}
            getOptionLabel={(option) => option.username}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={null}
            inputValue={inputValue}
            onInputChange={(_event, value) => setInputValue(value)}
            onChange={handleSelect}
            // Stay shut until there is something to search for, so an empty
            // field never shows a "no matches" dropdown.
            open={open && term.length > 0}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            loading={loading}
            autoHighlight
            blurOnSelect
            clearOnBlur
            handleHomeEndKeys={false}
            noOptionsText={pending ? t('nav.searching') : t('nav.noPhotographers')}
            sx={{ width: fullWidth ? '100%' : 200 }}
            slotProps={{
                paper: {
                    elevation: 0,
                    sx: {
                        mt: 1,
                        borderRadius: '0px',
                        border: `1px solid ${colors.borderLight}`,
                        backgroundColor: colors.surfaceBright || '#fff',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.08))',
                        '& .MuiAutocomplete-noOptions': {
                            fontFamily: typography.ui,
                            fontSize: '13px',
                            color: colors.textSecondary,
                        },
                    },
                },
            }}
            renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                    <Box
                        component="li"
                        key={key}
                        {...optionProps}
                        sx={{
                            fontFamily: typography.ui,
                            fontSize: '14px',
                            color: colors.text,
                            px: 2,
                            py: 1.25,
                            '&.MuiAutocomplete-option[aria-selected="true"], &.MuiAutocomplete-option.Mui-focused': {
                                backgroundColor: colors.hoverOverlaySubtle,
                            },
                        }}
                    >
                        {option.username}
                    </Box>
                );
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={t('nav.searchPlaceholder')}
                    slotProps={{
                        // Spread the params first: `htmlInput` carries Autocomplete's
                        // own keyboard handlers, so it must survive this merge.
                        ...params.slotProps,
                        input: {
                            ...params.slotProps.input,
                            startAdornment: (
                                <InputAdornment position="start" sx={{ color: colors.textSecondary, mr: 0 }}>
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <>
                                    {loading ? <CircularProgress size={14} sx={{ color: colors.textSecondary }} /> : null}
                                    {params.slotProps.input.endAdornment}
                                </>
                            ),
                        },
                        htmlInput: {
                            ...params.slotProps.htmlInput,
                            'aria-label': t('nav.searchPhotographers'),
                        },
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            fontFamily: typography.ui,
                            fontSize: '14px',
                            color: colors.text,
                            borderRadius: '0px',
                            backgroundColor: 'transparent',
                            py: '4px !important',
                            transition: 'border-color 0.3s ease, background-color 0.3s ease',
                            '& fieldset': {
                                borderColor: colors.borderLight,
                                borderRadius: '0px',
                            },
                            '&:hover fieldset': {
                                borderColor: colors.textSecondary,
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: colors.text,
                                borderWidth: '1px',
                            },
                        },
                        '& .MuiOutlinedInput-input::placeholder': {
                            color: colors.textSecondary,
                            opacity: 1,
                        },
                    }}
                />
            )}
        />
    );
}
