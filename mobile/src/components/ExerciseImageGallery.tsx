import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { appDependencies } from '../app/dependencies';
import type { ExerciseImage } from '../contracts/domain';
import { colors, fonts, radii, spacing, typography } from '../theme/theme';

/** Source and license of copied images (DEC-010), shown by default. */
export const imageAttribution =
  'Imagem: OpenExerciseBase (CC BY-NC 4.0); parte do material da fonte pode ter sido gerada por IA';

export function imageLabel(index: number, total: number, name: string) {
  return `Imagem ${index + 1} de ${total} do exercício ${name}`;
}

/**
 * Images of a catalog exercise served by the API with the bearer token
 * (DEC-010): the device never requests the provider. `limit` shows only the
 * first ones; the alt text keeps the total. Renders nothing without images.
 */
export function ExerciseImageGallery({
  images,
  exerciseName,
  limit,
  inverse = false,
  showAttribution = true,
}: {
  images: ExerciseImage[];
  exerciseName: string;
  limit?: number;
  /** Caption over a primary-colored background. */
  inverse?: boolean;
  /** Allows a compact review without changing image alt text or source data. */
  showAttribution?: boolean;
}) {
  if (!images.length) {
    return null;
  }
  const shown = limit === undefined ? images : images.slice(0, limit);
  return (
    <View style={gallery.root}>
      {shown.map((image, index) => (
        <ApiImage
          key={image.url}
          url={image.url}
          label={imageLabel(index, images.length, exerciseName)}
          inverse={inverse}
        />
      ))}
      {showAttribution ? (
        <Text style={[gallery.caption, inverse && gallery.inverseText]}>
          {imageAttribution}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One image with the current token. On the first failure (e.g. an expired
 * token) the session is renewed once and the image is requested again; after
 * that a short text replaces it.
 */
function ApiImage({
  url,
  label,
  inverse,
}: {
  url: string;
  label: string;
  inverse: boolean;
}) {
  const api = appDependencies.api;
  const [source, setSource] = useState(() => api.imageSource(url));
  const [failed, setFailed] = useState(source === null);
  const retried = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const onError = () => {
    if (retried.current) {
      setFailed(true);
      return;
    }
    retried.current = true;
    api.refreshAuthentication().then(
      () => {
        if (mounted.current) {
          setSource(api.imageSource(url));
        }
      },
      () => {
        if (mounted.current) {
          setFailed(true);
        }
      },
    );
  };
  if (failed || !source) {
    return (
      <Text style={[gallery.failure, inverse && gallery.inverseText]}>
        {`Não foi possível carregar a ${label.charAt(0).toLowerCase()}${label.slice(1)}.`}
      </Text>
    );
  }
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityIgnoresInvertColors
      onError={onError}
      style={gallery.image}
    />
  );
}

const gallery = StyleSheet.create({
  root: { gap: spacing.sm },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  caption: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.regular,
  },
  failure: {
    color: colors.textMuted,
    ...typography.bodySmall,
    fontFamily: fonts.regular,
  },
  inverseText: { color: colors.onPrimaryMuted },
});
