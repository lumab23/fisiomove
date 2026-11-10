import { useState, type ReactNode } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../components/Screen';
import { FormField } from '../../components/FormField';
import { Icon } from '../../components/Icon';
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
} from '../../components/ScreenStates';
import { useScreenMessage } from '../../components/ScreenMessage';
import { appDependencies } from '../../app/dependencies';
import type {
  CatalogExerciseStatus,
  LibraryAttribution,
  LibraryExerciseSummary,
  Side,
} from '../../contracts/domain';
import type { Resource } from '../../integration/usePatientData';
import {
  useLibraryExercise,
  useLibrarySearch,
} from '../../integration/useProfessionalData';
import {
  useFrontendNavigation,
  type FrontendStackParamList,
  type LibraryPickTarget,
} from '../../navigation/frontendTypes';
import {
  colors,
  fonts,
  layout,
  radii,
  spacing,
  typography,
} from '../../theme/theme';
import {
  Badge,
  Body,
  Button,
  Card,
  Link,
  ListGroup,
  ListRow,
  SectionTitle,
  Title,
} from '../../ui';
import { prescribedSideLabels } from '../patient/workoutText';
import {
  buildTranslation,
  emptyTranslation,
  TranslationFields,
  type TranslationDraft,
  type TranslationErrors,
} from './ExerciseTranslation';
import { apiErrorMessage, MultiChoiceGroup } from './shared';

/**
 * The library is reference material for the physiotherapist only. The
 * provider's texts are shown as received (original language, no edits). Only
 * the explicit "Adicionar ao catálogo" action creates a catalog exercise
 * (DEC-006), with the sides chosen here; prescription values are always typed
 * in the workout editor.
 */
export const catalogSeals = {
  notInCatalog: 'Material de referência — ainda não está no catálogo',
  addedByMe: 'Adicionado ao catálogo por você',
  addedByOther: 'Adicionado ao catálogo por outro fisioterapeuta',
  retired: 'Retirado do catálogo',
} as const;

export const prescriptionNotice =
  'Séries, repetições e descanso são definidos por você em cada treino.';

/** Seal text for an item, from `catalog_exercise` of the detail. */
export function catalogSealText(status: CatalogExerciseStatus | null) {
  if (!status) {
    return catalogSeals.notInCatalog;
  }
  if (status.approval_status !== 'approved') {
    return catalogSeals.retired;
  }
  return status.added_by_me
    ? catalogSeals.addedByMe
    : catalogSeals.addedByOther;
}

const sideOptions = (['left', 'right', 'bilateral'] as const).map(
  side => [side, prescribedSideLabels[side]] as const,
);

const catalogErrors: Record<string, string> = {
  catalog_exercise_revoked:
    'Este exercício foi retirado do catálogo e não pode ser adicionado de novo por aqui.',
  library_exercise_without_instructions:
    'A fonte não informa os passos deste exercício, por isso ele não pode entrar no catálogo.',
  external_library_unavailable:
    'A biblioteca externa não respondeu e nada foi salvo. Tente de novo em alguns instantes.',
  library_exercise_not_found:
    'Este exercício não está mais disponível na fonte.',
};

/** Upper-limb shortcuts (product scope); values as sent by the provider. */
export const upperLimbBodyParts = [
  ['shoulders', 'Ombros'],
  ['upper_back', 'Parte superior das costas'],
  ['chest', 'Peito'],
  ['triceps', 'Tríceps'],
  ['biceps', 'Bíceps'],
  ['forearms', 'Antebraços'],
  ['wrists', 'Punhos'],
  ['neck', 'Pescoço'],
] as const;

const bodyPartLabels: Record<string, string> =
  Object.fromEntries(upperLimbBodyParts);

/** Portuguese label for known parts; other provider values stay readable. */
export function bodyPartLabel(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, '_');
  return bodyPartLabels[key] ?? value.replace(/_/g, ' ');
}

/** True when the provider's `created_by` says the content came from AI. */
export function isAiGenerated(createdBy: string | null) {
  if (!createdBy) {
    return false;
  }
  const words = createdBy.toLowerCase().replace(/[_-]+/g, ' ');
  return /\b(ai|a\.i\.|ia|artificial intelligence|llm|gpt|generated)\b/.test(
    words,
  );
}

const unavailableCode = 'external_library_unavailable';
const pageSize = 20;

/** Loading/failure/empty states, with a specific text for a 503. */
function LibraryView<T>({
  resource,
  loadingLabel,
  empty,
  children,
}: {
  resource: Resource<T>;
  loadingLabel: string;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { state, reload } = resource;
  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingState label={loadingLabel} />;
  }
  if (state.status === 'failure') {
    return state.code === unavailableCode ? (
      <ErrorState
        title="Biblioteca indisponível no momento"
        message="A fonte externa não respondeu. Tente de novo em alguns instantes."
        onRetry={reload}
      />
    ) : (
      <ErrorState message={state.message} onRetry={reload} />
    );
  }
  if (state.status === 'empty' && empty !== undefined) {
    return <>{empty}</>;
  }
  return <>{children(state.data)}</>;
}

function CatalogSeal({ status }: { status: CatalogExerciseStatus | null }) {
  const text = catalogSealText(status);
  const inCatalog = status?.approval_status === 'approved';
  const color = inCatalog ? colors.success : colors.warningText;
  return (
    <View
      accessible
      accessibilityLabel={text}
      style={[s.seal, inCatalog && s.sealSuccess]}
    >
      <Icon name={inCatalog ? 'check' : 'alert'} size={22} color={color} />
      <Text style={[s.sealText, { color }]}>{text}</Text>
    </View>
  );
}

/** Text kept in the provider's language; screen readers switch voice. */
function OriginalText({
  children,
  language = 'en',
}: {
  children: string;
  language?: string;
}) {
  return (
    <Text accessibilityLanguage={language} style={s.body}>
      {children}
    </Text>
  );
}

/**
 * pt-BR equivalents of the fixed English notices of the library API
 * (`USAGE_NOTICE`/`CHANGES_NOTICE`, DEC-014). Another text from the API is
 * shown as received, marked as English.
 */
const libraryNotices: Record<string, string> = {
  'External reference material. A physiotherapist may add it to the FisioMove catalog for academic use; prescription values are always set by the physiotherapist.':
    'Material de referência externo. O fisioterapeuta pode adicioná-lo ao catálogo do FisioMove para uso acadêmico; os valores da prescrição são sempre definidos pelo fisioterapeuta.',
  'Only selected descriptive fields are shown; text is kept in the original language without edits. Performance metrics and variations are omitted.':
    'Mostramos só alguns campos descritivos; o texto fica no idioma original, sem edições. Métricas de desempenho e variações foram omitidas.',
};

function LibraryNotice({ children }: { children: string }) {
  const translated = libraryNotices[children.trim()];
  return translated ? (
    <Body>{translated}</Body>
  ) : (
    <OriginalText>{children}</OriginalText>
  );
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

function AttributionCard({ attribution }: { attribution: LibraryAttribution }) {
  return (
    <Card white title="Fonte e licença">
      <Body>{`Fonte: ${attribution.source}`}</Body>
      <Body>{`Licença: ${attribution.license}`}</Body>
      <Link
        label={`Abrir a licença ${attribution.license}`}
        onPress={() => openUrl(attribution.license_url)}
      />
      <Link
        label="Abrir a fonte dos dados"
        onPress={() => openUrl(attribution.source_url)}
      />
      <Body>Alterações feitas pelo FisioMove:</Body>
      <LibraryNotice>{attribution.changes}</LibraryNotice>
    </Card>
  );
}

function BodyPartFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const option = (part: string, label: string) => {
    const selected = part === value;
    return (
      <Pressable
        key={part || 'all'}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        onPress={() => onChange(part)}
        style={({ pressed }) => [
          s.chip,
          selected && s.chipSelected,
          pressed && !selected && s.chipPressed,
        ]}
      >
        <Text style={[s.chipText, selected && s.chipTextSelected]}>
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Parte do corpo"
      style={s.filter}
    >
      <Text style={s.label}>Parte do corpo</Text>
      <View style={s.chips}>{option('', 'Todas as partes')}</View>
      <Text style={s.caption}>Membros superiores</Text>
      <View style={s.chips}>
        {upperLimbBodyParts.map(([part, label]) => option(part, label))}
      </View>
    </View>
  );
}

function summaryText(item: LibraryExerciseSummary) {
  return item.body_parts.length
    ? item.body_parts.map(bodyPartLabel).join(', ')
    : 'Parte do corpo não informada';
}

export function ExerciseLibraryScreen() {
  const navigation = useFrontendNavigation();
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'ExerciseLibrary'>>();
  const pickFor = params?.pickFor;
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [page, setPage] = useState(1);
  const results = useLibrarySearch({
    query: query || undefined,
    body_part: bodyPart || undefined,
    page,
    page_size: pageSize,
  });
  const search = () => {
    setQuery(draft.trim());
    setPage(1);
  };
  const filtered = Boolean(query || bodyPart);
  return (
    <Screen
      professional
      back={pickFor ? 'Treino' : 'Configurações'}
      title="Biblioteca de referência"
    >
      <Body>
        {pickFor
          ? 'Escolha um exercício e adicione-o ao catálogo para usar neste treino.'
          : 'Exercícios de uma fonte externa. Para usar um deles em treinos, abra o exercício e adicione-o ao catálogo.'}
      </Body>
      <FormField
        label="Buscar pelo nome (em inglês)"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={search}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={100}
      />
      <Button secondary compact label="Buscar" onPress={search} />
      <BodyPartFilter
        value={bodyPart}
        onChange={value => {
          setBodyPart(value);
          setPage(1);
        }}
      />
      <LibraryView
        resource={results}
        loadingLabel="Carregando a biblioteca"
        empty={
          <EmptyState
            title="Nenhum exercício encontrado"
            message={
              filtered
                ? 'Tente outro nome ou outra parte do corpo.'
                : 'A fonte externa não devolveu exercícios.'
            }
            actionLabel={filtered ? 'Limpar filtros' : undefined}
            onAction={
              filtered
                ? () => {
                    setDraft('');
                    setQuery('');
                    setBodyPart('');
                    setPage(1);
                  }
                : undefined
            }
          />
        }
      >
        {data => (
          <>
            <LibraryNotice>{data.usage_notice}</LibraryNotice>
            <Body>
              {`${data.total} ${data.total === 1 ? 'exercício encontrado' : 'exercícios encontrados'}`}
            </Body>
            <ListGroup>
              {data.items.map(item => (
                <ListRow
                  key={item.external_id}
                  icon="info"
                  title={item.name}
                  description={summaryText(item)}
                  accessibilityHint="Abre o material de referência."
                  onPress={() =>
                    navigation.navigate('ExerciseLibraryDetail', {
                      externalId: item.external_id,
                      pickFor,
                    })
                  }
                />
              ))}
            </ListGroup>
            {data.pages > 1 ? (
              <View style={s.pager}>
                <Body>{`Página ${data.page} de ${data.pages}`}</Body>
                {data.page > 1 ? (
                  <Button
                    secondary
                    compact
                    label="Página anterior"
                    onPress={() => setPage(data.page - 1)}
                  />
                ) : null}
                {data.page < data.pages ? (
                  <Button
                    secondary
                    compact
                    label="Próxima página"
                    onPress={() => setPage(data.page + 1)}
                  />
                ) : null}
              </View>
            ) : null}
            <AttributionCard attribution={data.attribution} />
          </>
        )}
      </LibraryView>
    </Screen>
  );
}

export function ExerciseLibraryDetailScreen() {
  const { params } =
    useRoute<RouteProp<FrontendStackParamList, 'ExerciseLibraryDetail'>>();
  const exercise = useLibraryExercise(params.externalId);
  const { pickFor } = params;
  return (
    <Screen professional back="Biblioteca" title="Material de referência">
      <LibraryView resource={exercise} loadingLabel="Carregando o exercício">
        {data => (
          <>
            <Title>{data.name}</Title>
            <CatalogSeal status={data.catalog_exercise} />
            <LibraryNotice>{data.usage_notice}</LibraryNotice>
            {isAiGenerated(data.created_by) ? (
              <Card white title="Conteúdo gerado por IA">
                <Body>
                  Segundo a fonte, este conteúdo foi criado com inteligência
                  artificial.
                </Body>
                {data.review_status ? (
                  <Body>{`Situação de revisão na fonte: ${data.review_status}`}</Body>
                ) : null}
              </Card>
            ) : null}
            {data.image_urls.map((url, index) => (
              <Image
                key={url}
                source={{ uri: url }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                accessibilityLabel={`Imagem ${index + 1} de ${data.image_urls.length} do exercício ${data.name}`}
                style={s.image}
              />
            ))}
            <Card white title="Informações da fonte">
              <Body>
                {`Partes do corpo: ${data.body_parts.map(bodyPartLabel).join(', ') || 'não informadas'}`}
              </Body>
              <Body>
                {`Equipamento: ${data.equipment.join(', ') || 'não informado'}`}
              </Body>
              {data.created_by && !isAiGenerated(data.created_by) ? (
                <Body>{`Autoria informada pela fonte: ${data.created_by}`}</Body>
              ) : null}
              {data.review_status && !isAiGenerated(data.created_by) ? (
                <Body>{`Situação de revisão na fonte: ${data.review_status}`}</Body>
              ) : null}
            </Card>
            <SectionTitle>Passos</SectionTitle>
            <Badge label="Texto de referência" />
            {data.instructions.length ? (
              [...data.instructions]
                .sort((a, b) => a.step_number - b.step_number)
                .map(step => (
                  <View key={step.step_number} style={s.step}>
                    <Text style={s.stepNumber}>{`${step.step_number}.`}</Text>
                    <View style={s.stepText}>
                      <OriginalText language={data.instructions_language}>
                        {step.description}
                      </OriginalText>
                    </View>
                  </View>
                ))
            ) : (
              <Body>A fonte não informou passos para este exercício.</Body>
            )}
            <CatalogAction
              externalId={data.external_id}
              originalName={data.name}
              status={data.catalog_exercise}
              pickFor={pickFor}
              onAdded={exercise.reload}
            />
            <AttributionCard attribution={data.attribution} />
          </>
        )}
      </LibraryView>
    </Screen>
  );
}

/**
 * "Adicionar ao catálogo": the sides start unselected and at least one is
 * required. In pick mode the chosen exercise goes back to the workout editor,
 * which keeps its draft and fills only the exercise of the waiting item.
 */
function CatalogAction({
  externalId,
  originalName,
  status,
  pickFor,
  onAdded,
}: {
  externalId: string;
  originalName: string;
  status: CatalogExerciseStatus | null;
  pickFor?: LibraryPickTarget;
  onAdded: () => void;
}) {
  const navigation = useFrontendNavigation();
  const { show } = useScreenMessage();
  const [sides, setSides] = useState<Side[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [translation, setTranslation] =
    useState<TranslationDraft>(emptyTranslation);
  const [translationErrors, setTranslationErrors] = useState<TranslationErrors>(
    {},
  );
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const chooseForWorkout = (exerciseId: string) => {
    if (!pickFor) {
      return;
    }
    navigation.popTo(
      'WorkoutConfiguration',
      {
        patientId: pickFor.patientId,
        workoutId: pickFor.workoutId,
        picked: { itemKey: pickFor.itemKey, exerciseId },
      },
      { merge: true },
    );
  };
  if (status) {
    // Already in the catalog: sides and text were chosen on the first
    // addition; the pt-BR text is edited on its own screen (DEC-011).
    return status.approval_status === 'approved' ? (
      <>
        {pickFor ? (
          <Button
            label="Usar neste treino"
            onPress={() => chooseForWorkout(status.exercise_id)}
          />
        ) : null}
        <Button
          secondary
          label="Tradução em português"
          accessibilityHint="Abre o nome e os passos em português deste exercício do catálogo."
          onPress={() =>
            navigation.navigate('CatalogExerciseTranslation', {
              exerciseId: status.exercise_id,
            })
          }
        />
      </>
    ) : null;
  }
  const add = async () => {
    if (busy) {
      return;
    }
    setFailure('');
    const built = buildTranslation(translation, false);
    if ('errors' in built) {
      setTranslationErrors(built.errors);
    }
    if (!sides.length) {
      setError('Escolha pelo menos um lado.');
    }
    if (!sides.length || 'errors' in built) {
      return;
    }
    setBusy(true);
    try {
      const added = built.translation
        ? await appDependencies.exerciseLibrary.addToCatalog(
            externalId,
            sides,
            built.translation,
          )
        : await appDependencies.exerciseLibrary.addToCatalog(externalId, sides);
      if (pickFor) {
        show('Exercício adicionado ao catálogo e escolhido para o treino.');
        chooseForWorkout(added.id);
      } else {
        show('Exercício adicionado ao catálogo.');
        setBusy(false);
        onAdded();
      }
    } catch (cause) {
      setFailure(apiErrorMessage(cause, catalogErrors));
      setBusy(false);
    }
  };
  return (
    <Card white title="Adicionar ao catálogo">
      <Body>{prescriptionNotice}</Body>
      {failure ? <InlineError message={failure} /> : null}
      <MultiChoiceGroup
        label="Lados permitidos"
        options={sideOptions}
        value={sides}
        onChange={value => {
          setSides(value);
          setError(undefined);
        }}
        error={error}
      />
      <SectionTitle>Texto em português (opcional)</SectionTitle>
      <Body>
        Sem tradução, o paciente vê o nome e os passos originais em inglês.
        Preencha os dois campos ou deixe os dois vazios. O original continua
        guardado e aparece acima como referência.
      </Body>
      <Text style={s.caption}>Nome original</Text>
      <OriginalText>{originalName}</OriginalText>
      <TranslationFields
        optional
        draft={translation}
        errors={translationErrors}
        onChange={value => {
          setTranslation(value);
          setTranslationErrors({});
        }}
      />
      <Button
        label={
          busy
            ? 'Adicionando…'
            : pickFor
              ? 'Adicionar e usar neste treino'
              : 'Adicionar ao catálogo'
        }
        disabled={busy}
        onPress={add}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  seal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warningBackground,
  },
  sealSuccess: { backgroundColor: colors.successBackground },
  sealText: {
    flex: 1,
    color: colors.warningText,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  body: {
    color: colors.textMuted,
    ...typography.body,
    fontFamily: fonts.regular,
  },
  filter: { gap: spacing.sm },
  label: {
    color: colors.primary,
    ...typography.bodySmall,
    fontFamily: fonts.bold,
  },
  caption: {
    color: colors.textMuted,
    ...typography.caption,
    fontFamily: fonts.bold,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: layout.compactControlHeight,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipPressed: { backgroundColor: colors.surfaceMuted },
  chipText: {
    color: colors.text,
    ...typography.bodySmall,
    fontFamily: fonts.regular,
  },
  chipTextSelected: { color: colors.onPrimary, fontFamily: fonts.bold },
  pager: { gap: spacing.sm },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  step: { flexDirection: 'row', gap: spacing.md },
  stepNumber: {
    color: colors.primary,
    ...typography.body,
    fontFamily: fonts.bold,
  },
  stepText: { flex: 1 },
});
