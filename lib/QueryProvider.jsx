'use client' 
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';


const QueryProvider = ({children}) => {
    const [queryClient] = React.useState(() => new QueryClient());
  return ( 
    <div>
        <QueryClientProvider client={queryClient}>
            <ReactQueryDevtools  initialIsOpen={false} />
            {children}
        </QueryClientProvider>
    </div>
  )
}

export default QueryProvider
