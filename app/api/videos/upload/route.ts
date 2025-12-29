import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:3333'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        const response = await fetch(`${API_URL}/api/videos/upload`, {
            method: 'POST',
            body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Upload error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to upload video', message },
            { status: 500 }
        )
    }
}
