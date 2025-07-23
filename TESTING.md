# Manual Testing Guide for Info/Quiz Section Rigidification

This guide provides step-by-step instructions to manually verify that all requirements have been implemented correctly.

## Prerequisites

1. Set up a valid OpenAI API key in `script.js`
2. Start the local server: `python3 -m http.server 8000`
3. Open browser to `http://localhost:8000`

## Test 1: Comprehensive Requirements Validation

**Purpose**: Verify ALL requirements from problem statement are met

**Steps**:
1. Navigate to `http://localhost:8000/comprehensive-test.html`
2. Click "🚀 Run All Requirement Tests"
3. Verify all tests show green checkmarks (✓)

**Expected Result**: All requirement validations pass (should show 100% compliance)

## Test 2: Automated Validation Tests

**Purpose**: Verify all code-level requirements are met

**Steps**:
1. Navigate to `http://localhost:8000/test-validation.html`
2. Click "Run All Tests"
3. Verify all tests show green checkmarks (✓)

**Expected Result**: All 14 validation tests pass

---

## Test 3: Info Gathering Questions (Rigid Order)

**Purpose**: Verify exactly 6 questions in the correct sequence

**Steps**:
1. Navigate to main app and validate API key
2. Start conversation with Agent Alpha
3. Monitor console logs for question progression
4. Answer each question and verify the next question follows the sequence:
   1. Name
   2. Favorite food
   3. Hobby
   4. Fact about hobby
   5. **Job/occupation** (changed from "fun fact")
   6. **Fun fact about user** (changed from "final question")

**Expected Result**:
- Console shows: `📊 INFO GATHERING PROGRESS: Question X of 6 completed`
- Exactly 6 questions asked in correct order
- No additional questions after #6
- Clear transition modal appears after question #6

**Console Validation**:
- Look for: `🚫 INFO GATHERING BOUNDARY ENFORCED: 6 questions completed`
- Look for: `📋 RIGID PHASE TRANSITION: Moving to quiz phase`

---

## Test 4: Quiz Phase - Agent A (Perfect Memory)

**Purpose**: Verify Agent A uses natural LLM responses

**Steps**:
1. Complete info gathering phase
2. In quiz phase, ask 4 different questions
3. Monitor console logs for Agent A behavior
4. Verify responses are natural and contextual (not direct repetition)

**Expected Result**:
- Console shows: `📝 AGENT ALPHA: Using LLM for accurate response (NO PARROTING)`
- Responses are conversational and intelligent
- Answers are accurate to user's provided information
- No verbatim repetition of user input

---

## Test 5: Quiz Phase - Agent B (Imperfect Memory)

**Purpose**: Verify Agent B follows randomized error pattern

**Steps**:
1. Complete Agent A session and start Agent B
2. Complete info gathering for Agent B
3. In quiz phase, monitor console for Agent B's planned pattern
4. Ask all 4 quiz questions
5. Verify the pattern is followed

**Expected Result**:
- Console shows: `🎲 AGENT B QUIZ BEHAVIOR PLAN (RANDOMIZED)`
- Shows specific turns for: CONFIDENTLY INCORRECT and VAGUE/UNCERTAIN
- Pattern validation: `🔍 PATTERN VALIDATION: Turn X follows predetermined error pattern`
- Final validation: `validateAgentBQuizPattern()` output confirms 2 correct + 1 incorrect + 1 vague

---

## Test 6: Quiz Review Timing (5-Second Delay)

**Purpose**: Verify minimum 5-second delay before quiz review

**Steps**:
1. Complete 4 quiz questions for any agent
2. Time the transition modal duration
3. Check console logs for timing enforcement

**Expected Result**:
- Console shows: `⏱️ ENFORCING 5-SECOND MINIMUM DELAY before quiz review transition`
- Transition modal displays for at least 5 seconds
- User can read all responses before proceeding
- Modal message mentions "5-second minimum delay enforced"

---

## Test 7: Rigid Phase Boundaries

**Purpose**: Verify no agent conversation outside defined phases

**Steps**:
1. Try to continue conversation after question #6
2. Verify quiz phase only allows question selection
3. Confirm rating phase has no chat interface

**Expected Result**:
- No chat input available after info gathering completion
- Clear non-agent UI transitions between phases
- No LLM-generated conversation outside defined boundaries
- Phase transitions are immediate and non-negotiable

---

## Test 8: Multiple Session Randomization

**Purpose**: Verify Agent B pattern changes between sessions

**Steps**:
1. Complete one full session (both agents)
2. Refresh browser and start new session
3. Compare Agent B's error patterns between sessions

**Expected Result**:
- Different turns are selected for errors in each session
- Agent B never answers all 4 questions correctly
- Randomization ensures variability across sessions

---

## Test 9: Logging Validation

**Purpose**: Verify comprehensive logging for validation

**Steps**:
1. Open browser console before starting
2. Complete full session for both agents
3. Review console output for required logging

**Expected Console Output**:
- `🚀 STARTING INFO GATHERING: Agent X, Question 1 of 6 maximum`
- `📊 INFO GATHERING PROGRESS` for each question
- `🚫 INFO GATHERING BOUNDARY ENFORCED` after question 6
- `🎲 AGENT B QUIZ BEHAVIOR PLAN (RANDOMIZED)` with specific pattern
- `🎯 QUIZ QUESTION X/4` for each quiz question
- `⏱️ ENFORCING 5-SECOND MINIMUM DELAY`
- `🔍 PATTERN VALIDATION` messages

---

## Test 10: Documentation Accuracy

**Purpose**: Verify README matches implementation

**Steps**:
1. Review README.md Phase 1 section
2. Compare with actual app behavior

**Expected Result**:
- README lists correct 6 questions in order
- Documentation mentions rigid enforcement
- Question sequence matches: Name → Favorite food → Hobby → Fact about hobby → Job/occupation → Fun fact

---

## Troubleshooting

### If Info Questions Don't Follow Sequence:
- Check console for `infoQuestionSequence` array
- Verify `storeUserInfo` uses correct keys
- Look for prompt enforcement in system messages

### If Agent B Answers All Correctly:
- Check `generateAgentBErrorTurns()` execution
- Verify error turns are different values
- Look for pattern validation failure logs

### If Timing Is Incorrect:
- Check `endQuizPhase()` transition duration
- Verify 5000ms parameter in `showPhaseTransition`
- Look for timing enforcement logs

### If Validation Tests Fail:
- Check browser console for JavaScript errors
- Verify all code changes are saved
- Refresh test page and re-run tests