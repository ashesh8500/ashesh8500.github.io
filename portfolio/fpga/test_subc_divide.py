import numpy as np
from subc_divide import subc_divide
import matplotlib.pyplot as plt
import pandas as pd
import os
import argparse

def test_subc_divide(
        ntest : int = 100
):
    """
    Test the subc_divide function with random values.
    
    Tests ntest = 100 random cases where:
    - b > a >= 0
    - a, b are np.uint32
    - nbits varies randomly
    
    Computes qhat = z/(2**nbits) and stores all values in numpy arrays.

    Parameters
    ----------
    ntest : int
        Number of random test cases to generate. Default is 100.
    
    """

    # Initialize arrays to store test values and results
    a_vals = np.zeros(ntest, dtype=np.uint32)
    b_vals = np.zeros(ntest, dtype=np.uint32)
    nbits_vals = np.zeros(ntest, dtype=np.int32)
    z_vals = np.zeros(ntest, dtype=np.uint32)
    qhat_vals = np.zeros(ntest, dtype=np.float64)
    errors = np.zeros(ntest, dtype=np.float64)
    passed = np.zeros(ntest, dtype=int)
       
    # Generate random test cases
    for i in range(ntest):
        # Generate random b (divisor) - avoid very small values
        b = np.uint32(np.random.randint(10, 2**16))
        
        # Generate random a (dividend) such that 0 <= a < b
        a = np.uint32(np.random.randint(0, int(b)))
        
        # Generate random nbits 
        nbits = int(np.random.randint(4, 16))
        
        # Compute z using subc_divide
        z = subc_divide(a, b, nbits)
        
        # Compute qhat = z / (2**nbits)
        qhat = z / (2**nbits)
        
        # Store values
        a_vals[i] = a
        b_vals[i] = b
        nbits_vals[i] = nbits
        z_vals[i] = z
        qhat_vals[i] = qhat
        errors[i] = np.abs((a / b) - qhat)
        if errors[i] < (1 / (2**nbits)):
            passed[i] = 1
        else: 
            passed[i] = 0
 
    # Make a test vector directory tv
    tv_dir = 'test_outputs'
    os.makedirs(tv_dir, exist_ok=True)

    
    # Export to CSV
    df = pd.DataFrame({
        'a': a_vals,
        'b': b_vals,
        'nbits': nbits_vals,
        'z': z_vals,
        'qhat': qhat_vals,
        'error': errors,
        'passed': passed
    })
    fn = os.path.join(tv_dir, 'tv_python.csv')
    df.to_csv(fn, index=False)

    # Display summary
    print(f"Test results saved to {fn}")
    print(f"Number of tests passed: {np.sum(passed)} out of {ntest}")
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test the subc_divide function')
    parser.add_argument('--ntest', type=int, default=100, 
                        help='Number of random test cases to generate (default: 100)')
    args = parser.parse_args()
    
    results = test_subc_divide(ntest=args.ntest)
