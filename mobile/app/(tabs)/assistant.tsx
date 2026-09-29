import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { LoadingBlock, NoticeCard } from '../../src/components/Ui';
import { askAssistant } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';
import type { AssistantAnswer } from '../../src/types/legal';

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [hasAuthenticated, setHasAuthenticated] = useState(false);
  const [submittedQuestion, setSubmittedQuestion] = useState<string>();
  const [answer, setAnswer] = useState<AssistantAnswer>();
  const [notice, setNotice] = useState<string>();
  const [validationError, setValidationError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const normalizedQuestion = question.trim();
    if (normalizedQuestion.length < 3) {
      setValidationError('Введите вопрос хотя бы из трёх символов.');
      return;
    }
    if (!accessCode.trim()) {
      setValidationError('Сначала введите код доступа к помощнику. Это не API-ключ Polza AI.');
      return;
    }

    setValidationError(undefined);
    setNotice(undefined);
    setAnswer(undefined);
    setSubmittedQuestion(normalizedQuestion);
    setIsSubmitting(true);
    const result = await askAssistant({
      question: normalizedQuestion,
      accessCode: accessCode.trim(),
    });
    setAnswer(result.data);
    setNotice(result.notice);
    if (result.data) {
      setHasAuthenticated(true);
      setQuestion('');
    } else if (result.notice?.includes('код доступа')) {
      setHasAuthenticated(false);
    }
    setIsSubmitting(false);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: 'height', default: undefined })}
        keyboardVerticalOffset={0}
        style={styles.keyboardAvoider}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Помощник</Text>
            <Text style={styles.subtitle}>Задайте вопрос по документам</Text>
          </View>

          {!hasAuthenticated ? (
            <View style={styles.accessPanel}>
              <Text style={styles.accessLabel}>Код доступа к помощнику</Text>
              <TextInput
                accessibilityLabel="Код доступа к помощнику"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setAccessCode}
                placeholder="Введите личный код"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={styles.accessInput}
                value={accessCode}
              />
              <Text style={styles.accessHint}>Ключ Polza AI сюда вводить нельзя.</Text>
            </View>
          ) : null}

          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={styles.messages}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!submittedQuestion ? (
              <Text style={styles.emptyHint}>Напишите свой вопрос в поле ниже.</Text>
            ) : null}

            {submittedQuestion ? (
              <View style={[styles.message, styles.userMessage]}>
                <Text style={styles.userMessageText}>{submittedQuestion}</Text>
              </View>
            ) : null}

            {isSubmitting ? <LoadingBlock label="Готовим ответ…" /> : null}

            {answer ? (
              <View style={[styles.message, styles.assistantMessage]}>
                <Text style={styles.answerText}>{answer.answer}</Text>
                {answer.sources.length > 0 ? (
                  <View style={styles.sources}>
                    <Text style={styles.sourcesTitle}>Возможно связанные документы</Text>
                    {answer.sources.map((source) => (
                      <Pressable
                        accessibilityRole="button"
                        key={source.document_id}
                        onPress={() =>
                          router.push({
                            pathname: '/document/[id]',
                            params: { id: source.document_id },
                          })
                        }
                      >
                        <Text style={styles.sourceLink}>{source.title} →</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.answerNote}>{answer.disclaimer}</Text>
              </View>
            ) : null}

            {notice ? <NoticeCard title="Не удалось получить ответ" message={notice} /> : null}
          </ScrollView>

          {validationError ? <Text style={styles.validationError}>{validationError}</Text> : null}
          <View style={[styles.composer, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
            <TextInput
              accessibilityLabel="Вопрос помощнику"
              multiline
              onChangeText={setQuestion}
              onSubmitEditing={() => void submit()}
              placeholder="Напишите вопрос…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlignVertical="top"
              value={question}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitting }}
              disabled={isSubmitting}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.sendButton,
                (pressed || isSubmitting) && styles.sendButtonPressed,
              ]}
            >
              <Text style={styles.sendButtonText}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoider: { flex: 1 },
  page: { flex: 1, padding: spacing.md },
  header: { gap: 2, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  accessPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  accessLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  accessInput: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: spacing.sm,
  },
  accessHint: { color: colors.textMuted, fontSize: 12 },
  messages: {
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'flex-end',
    paddingVertical: spacing.md,
  },
  emptyHint: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  message: { borderRadius: radius.lg, maxWidth: '88%', padding: spacing.md },
  userMessage: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    gap: spacing.sm,
  },
  userMessageText: { color: colors.surface, fontSize: 16, lineHeight: 23 },
  answerText: { color: colors.text, fontSize: 16, lineHeight: 24 },
  sources: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  sourcesTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  sourceLink: { color: colors.primary, fontSize: 14, lineHeight: 20 },
  answerNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  validationError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    paddingBottom: spacing.xs,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  input: { color: colors.text, flex: 1, fontSize: 16, maxHeight: 120, minHeight: 44, padding: 8 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendButtonPressed: { opacity: 0.65 },
  sendButtonText: { color: colors.surface, fontSize: 23, fontWeight: '800', lineHeight: 26 },
});
