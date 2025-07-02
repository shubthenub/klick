import { SignIn } from '@clerk/nextjs'
import React from 'react'
const signInAppearance = {
      elements: {
        avatarBox: "w-12 h-12", // Example: Adjusting width and height
      },
};
const SignInPage = () => {
  return (
    <SignIn appearance={signInAppearance}/>
  )
}

export default SignInPage
