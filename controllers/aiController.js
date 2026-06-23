import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import Snippet from '../models/Snippet.js'
import AiReview from '../models/AiReview.js'
import { sendNotification } from '../utils/notify.js'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const extractJSON = (str) => {
  const trimmed = str.trim()

  try {
    return JSON.parse(trimmed)
  } catch (e) {
    // ignore and continue
  }

  let cleaned = trimmed
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/, '')
      .trim()
    try {
      return JSON.parse(cleaned)
    } catch (e) {
      // ignore and continue
    }
  }

  const startIdx = cleaned.indexOf('{')
  if (startIdx !== -1) {
    let braceCount = 0
    for (let i = startIdx; i < cleaned.length; i++) {
      if (cleaned[i] === '{') {
        braceCount++
      } else if (cleaned[i] === '}') {
        braceCount--
        if (braceCount === 0) {
          const candidate = cleaned.substring(startIdx, i + 1)
          try {
            return JSON.parse(candidate)
          } catch (e) {
            // ignore and continue
          }
        }
      }
    }
  }

  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch (e) {
      // ignore and continue
    }
  }

  throw new Error('AI returned invalid response format')
}

export const generateAiReview = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id).populate(
      'author',
      'username'
    )
    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found' })
    }

    const existingReview = await AiReview.findOne({
      user: req.user._id,
      snippet: snippet._id,
    })

    if (existingReview?.generatedAt && req.query.force !== 'true') {
      return res.json({ aiReview: existingReview, cached: true })
    }

    const useGemini = !!process.env.GEMINI_API_KEY
    const useOpenAI = !useGemini && !!process.env.OPENAI_API_KEY

    if (!useGemini && !useOpenAI) {
      return res.status(503).json({
        message:
          'AI review is not configured (missing GEMINI_API_KEY or OPENAI_API_KEY)',
      })
    }

    const systemPrompt = `You are an expert code reviewer. Analyze the provided code and return ONLY a JSON object (no markdown, no extra text) with this exact structure:
{
  "summary": "2-3 sentence overview of what the code does and its overall quality",
  "bugs": ["specific bug or issue 1", "specific bug or issue 2"],
  "suggestions": ["actionable improvement 1", "actionable improvement 2", "actionable improvement 3"],
  "complexityRating": "Time: O(...) | Space: O(...)"
}
Keep each item concise (1-2 sentences max). If no bugs are found, return an empty array. Maximum 3 bugs and 4 suggestions.`

    const userPrompt = `Review this ${snippet.language} code snippet titled "${snippet.title}":

\`\`\`${snippet.language}
${snippet.code}
\`\`\``

    let raw = ''

    if (useGemini) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const prompt = `${systemPrompt}\n\n${userPrompt}`
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { responseMimeType: 'application/json' },
      })

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      let lastError

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await Promise.race([
            model.generateContent(prompt),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Gemini timeout')), 15000)
            ),
          ])
          const response = await result.response
          raw = response.text().trim()
          lastError = null
          break
        } catch (error) {
          lastError = error

          const status =
            error?.status ||
            error?.response?.status ||
            error?.code ||
            (error?.message && error.message.includes('503') ? 503 : null) ||
            (error?.message && error.message.includes('429') ? 429 : null)

          if ((status === 429 || status === 503) && attempt < 2) {
            const delay = 1000 * Math.pow(2, attempt)
            console.warn(
              `Gemini request failed (${status || error.message}). Retrying in ${delay}ms...`
            )
            await sleep(delay)
            continue
          }

          break
        }
      }

      if (lastError) {
        const status =
          lastError?.status ||
          lastError?.response?.status ||
          (lastError?.message && lastError.message.includes('503')
            ? 503
            : null) ||
          (lastError?.message && lastError.message.includes('429') ? 429 : null)

        if (status === 429) {
          return res.status(429).json({
            success: false,
            message:
              'AI reviewer is receiving too many requests right now. Please try again in a minute.',
          })
        }

        if (status === 503) {
          return res.status(503).json({
            success: false,
            message:
              'AI reviewer is temporarily busy. Please try again in a few moments.',
          })
        }

        if (lastError.message === 'Gemini timeout') {
          return res.status(504).json({
            success: false,
            message:
              'AI review timed out. The service may be under heavy load. Please try again in a few moments.',
          })
        }

        throw lastError
      }
    } else {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      })
      raw = completion.choices[0]?.message?.content?.trim()
    }

    const review = extractJSON(raw)

    let aiReview = await AiReview.findOne({
      user: req.user._id,
      snippet: snippet._id,
    })

    if (!aiReview) {
      aiReview = new AiReview({
        user: req.user._id,
        snippet: snippet._id,
      })
    }

    aiReview.summary = review.summary || ''
    aiReview.bugs = Array.isArray(review.bugs) ? review.bugs : []
    aiReview.suggestions = Array.isArray(review.suggestions)
      ? review.suggestions
      : []
    aiReview.complexityRating = review.complexityRating || 'N/A'
    aiReview.generatedAt = new Date()

    await aiReview.save()

    await sendNotification(req.app.get('io'), {
      recipient: req.user._id,
      actor: req.user._id,
      type: 'ai_review_complete',
      snippetId: snippet._id,
      snippetTitle: snippet.title,
    })

    return res.json({ aiReview, cached: false })
  } catch (err) {
    console.error('AI review error:', err)
    const status = err.status || err.statusCode
    if (
      status === 400 &&
      /model|not found|not supported/i.test(err.message || '')
    ) {
      return res.status(503).json({
        message:
          'AI review model is not available. Set GEMINI_MODEL or OPENAI_MODEL to a model enabled for your API key.',
      })
    }
    return res.status(500).json({
      message: err.message || 'Failed to generate AI review',
    })
  }
}
