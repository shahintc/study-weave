import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import axios from '../api/axios'; // We import your special "waiter"



function AdminRoleManagementPage() {
  
  // --- 2. SET UP STATE ---
  // The list of users starts empty.
  const [users, setUsers] = useState([]);
  // A status message for loading or errors
  const [status, setStatus] = useState("Loading users...");

  // --- 3. FETCH ALL USERS WHEN THE PAGE LOADS ---
  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        // We "call" the "/api/auth/users" endpoint you already had!
        const response = await axios.get('/api/auth/users');
        
        if (response.data.users && response.data.users.length > 0) {
          // We filter out the 'admin' role, just as you said
          const filteredUsers = response.data.users.filter(
            user => user.role === 'participant' || user.role === 'researcher'
          );
          setUsers(filteredUsers);
        } else {
          setStatus("No users found.");
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setStatus("Failed to load users. Please try again later.");
      }
    };
    
    fetchAllUsers();
  }, []); // The empty [] means "run this only once"

  // --- 4. THIS IS THE NEW "CHANGE ROLE" FUNCTION ---
  // It now calls your *new* backend endpoint!
  const handleChangeRole = async (idToChange) => {
    try {
      // We "call" your new "update-role" endpoint
      // We use the ID in the URL, just like you built it
      const response = await axios.put(`/api/auth/update-role/${idToChange}`);
      
      // The backend sends back the *updated* user.
      const updatedUser = response.data.user;

      // We update our local list in React to show the change immediately
      setUsers(currentUsers =>
        currentUsers.map(user =>
          user.id === updatedUser.id ? updatedUser : user
        )
      );
    } catch (error) {
      console.error('Failed to update role:', error);
      // We could show an error message to the user here
    }
  };

  // --- 5. RENDER THE PAGE ---
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Admin: User Role Management</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* We map over our list of *real* users */}
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'researcher' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {/* This button will call our new function! */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleChangeRole(user.id)}
                      >
                        Change Role
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                /* This shows "Loading..." or "No users found." */
                <TableRow>
                  <TableCell colSpan="4" className="text-center text-gray-500">
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

export default AdminRoleManagementPage;