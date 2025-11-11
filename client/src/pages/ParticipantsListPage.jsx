import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import axios from '../api/axios'; 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // We'll use the shadcn Table!

// This is the "waiter" function
function ParticipantsListPage() {
  
  // --- 1. SET UP STATE ---
  // A place to store the list of participants when it arrives
  const [participants, setParticipants] = useState([]);
  // A place to store any loading or error messages
  const [status, setStatus] = useState("Loading...");

  
  useEffect(() => {
    // This function runs one time when the page loads
    const fetchParticipants = async () => {
      try {
        // This is the "order" to your "kitchen" (the backend)
        // We use /api/participants because your server.js file is set up to route /api requests
        const response = await axios.get('/api/auth/participants'); 
        
        setParticipants(response.data.users); 
      } catch (error) {
        console.error('Failed to fetch participants:', error);
        setStatus("Failed to load participants. Please try again later.");
      }
    };

    fetchParticipants(); // Call the function
  }, []); // The empty [] means "run this only once"

  // --- 3. RENDER THE PAGE ---
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Participants List</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>All Enrolled Participants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Joined On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* If the list has users, map over them and create a row for each one */}
              {participants.length > 0 ? (
                participants.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="font-medium">{part.name}</TableCell>
                    <TableCell>{part.email}</TableCell>
                    <TableCell>{new Date(part.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                /* If the list is empty, show the status message */
                <TableRow>
                  <TableCell colSpan="3" className="text-center text-gray-500">
                    {status}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default ParticipantsListPage;