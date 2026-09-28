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

import { LoadingBlock, NoticeCard } from '../../src/components/Ui';
import { askAssistant } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';
import type { AssistantAnswer } from '../../src/types/legal';

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState('');
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

    setValidationError(undefined);
    setNotice(undefined);
    setSubmittedQuestion(normalizedQuestion);
    setQuestion('');
    setIsSubmitting(true);
    const result = await askAssistant({ question: normalizedQuestion });
    setAnswer(result.data);
    setNotice(result.notice);
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
