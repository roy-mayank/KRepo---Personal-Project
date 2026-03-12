import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Chat from '@/components/Chat'
import DocumentUpload from '@/components/DocumentUpload'
import Onboarding from '@/components/Onboarding'

function App() {
  return (
    <div className="dark flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex h-full w-full max-w-3xl flex-col">
        <Tabs defaultValue="chat" className="flex h-full flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="chat" className="flex-1">
              Chat
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">
              Documents
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="flex-1">
              Onboarding
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex-1 overflow-hidden">
            <Chat />
          </TabsContent>
          <TabsContent value="documents" className="flex-1 overflow-hidden">
            <DocumentUpload />
          </TabsContent>
          <TabsContent value="onboarding" className="flex-1 overflow-hidden">
            <Onboarding />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
