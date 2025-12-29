import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:3333'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const response = await fetch(`${API_URL}/api/videos/${id}/status`, {
            method: 'GET',
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Status error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: 'Failed to get status', message },
            { status: 500 }
        )
    }
}
