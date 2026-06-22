import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import Snippet from '../models/Snippet.js'
import AiReview from '../models/AiReview.js'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/**
 * POST /api/snippets/:id/ai-review
 * Sends the snippet code to Gemini (or GPT-4) and gets back a structured code review.
 * Stores the result in snippet.aiReview and returns it.
 * Rate-limited: won't re-generate if review already exists (unless ?force=true).
 */
export const generateAiReview = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id).populate(
      'author',
      'username'
    )
    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found' })
    }

    // Find existing AI review for this user and snippet
    const existingReview = await AiReview.findOne({
      user: req.user._id,
      snippet: snippet._id,
    })

    // Return cached review unless force refresh requested
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

    // Structured prompt — forces the AI to return valid JSON
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

      try {
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { responseMimeType: 'application/json' },
        })
        const result = await model.generateContent(prompt)
        const response = await result.response
        raw = response.text().trim()
      } catch (geminiError) {
        if (
          geminiError.status === 429 ||
          (geminiError.message && geminiError.message.includes('429'))
        ) {
          console.warn('Gemini 2.0 Flash rate limited.')
          return res.status(429).json({
            message:
              'AI service is currently rate-limited. Please try again in a few moments.',
          })
        } else {
          throw geminiError
        }
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

    // Parse the JSON response
    let review
    try {
      review = JSON.parse(raw)
    } catch {
      // If AI didn't return clean JSON, extract it
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        review = JSON.parse(match[0])
      } else {
        throw new Error('AI returned invalid response format')
      }
    }

    // Save review to the AiReview document per user and snippet
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
