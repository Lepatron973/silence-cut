import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:3333'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const response = await fetch(`${API_URL}/api/videos/${id}/process`, {
            method: 'POST',
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Process error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to start processing', message },
            { status: 500 }
        )
    }
}
